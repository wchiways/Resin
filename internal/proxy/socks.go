package proxy

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/Resinat/Resin/internal/config"
	"github.com/Resinat/Resin/internal/netutil"
	"github.com/Resinat/Resin/internal/outbound"
	"github.com/Resinat/Resin/internal/routing"
	M "github.com/sagernet/sing/common/metadata"
)

// SOCKS5 protocol constants (RFC 1928).
const (
	socks5Version byte = 0x05

	// Authentication methods.
	socks5AuthNone             byte = 0x00
	socks5AuthUsernamePassword byte = 0x02
	socks5AuthNoAcceptable     byte = 0xFF

	// Username/password sub-negotiation version (RFC 1929).
	socks5AuthUPVersion byte = 0x01
	socks5AuthUPSuccess byte = 0x00
	socks5AuthUPFailure byte = 0x01

	// Commands.
	socks5CmdConnect      byte = 0x01
	socks5CmdBind         byte = 0x02
	socks5CmdUDPAssociate byte = 0x03

	// Address types.
	socks5AtypIPv4   byte = 0x01
	socks5AtypDomain byte = 0x03
	socks5AtypIPv6   byte = 0x04

	// Reply codes.
	socks5RepSucceeded               byte = 0x00
	socks5RepGeneralFailure          byte = 0x01
	socks5RepConnectionNotAllowed    byte = 0x02
	socks5RepNetworkUnreachable      byte = 0x03
	socks5RepHostUnreachable         byte = 0x04
	socks5RepConnectionRefused       byte = 0x05
	socks5RepTTLExpired              byte = 0x06
	socks5RepCommandNotSupported     byte = 0x07
	socks5RepAddressTypeNotSupported byte = 0x08

	socks5StageGreeting = "socks5_greeting"
	socks5StageAuth     = "socks5_auth"
	socks5StageRequest  = "socks5_request"
	socks5StageRoute    = "socks5_route"
)

// SOCKS5Config holds dependencies for the SOCKS5 server.
type SOCKS5Config struct {
	ProxyToken  string
	AuthVersion string
	Router      *routing.Router
	Pool        outbound.PoolAccessor
	Health      HealthRecorder
	Events      EventEmitter
	MetricsSink MetricsEventSink
}

// SOCKS5Server accepts SOCKS5 connections on a dedicated listener.
type SOCKS5Server struct {
	token       string
	authVersion config.AuthVersion
	router      *routing.Router
	pool        outbound.PoolAccessor
	health      HealthRecorder
	events      EventEmitter
	metricsSink MetricsEventSink

	mu       sync.Mutex
	listener net.Listener
	closed   bool
}

// NewSOCKS5Server creates a new SOCKS5 server.
func NewSOCKS5Server(cfg SOCKS5Config) *SOCKS5Server {
	ev := cfg.Events
	if ev == nil {
		ev = NoOpEventEmitter{}
	}
	authVersion := config.NormalizeAuthVersion(cfg.AuthVersion)
	if authVersion == "" {
		authVersion = config.AuthVersionLegacyV0
	}
	return &SOCKS5Server{
		token:       cfg.ProxyToken,
		authVersion: authVersion,
		router:      cfg.Router,
		pool:        cfg.Pool,
		health:      cfg.Health,
		events:      ev,
		metricsSink: cfg.MetricsSink,
	}
}

// Serve accepts connections from the listener and handles each in a goroutine.
// Blocks until the listener is closed.
func (s *SOCKS5Server) Serve(ln net.Listener) error {
	s.mu.Lock()
	s.listener = ln
	s.mu.Unlock()

	for {
		conn, err := ln.Accept()
		if err != nil {
			s.mu.Lock()
			closed := s.closed
			s.mu.Unlock()
			if closed {
				return nil
			}
			return fmt.Errorf("socks5 accept: %w", err)
		}
		go s.handleConn(conn)
	}
}

// Close stops accepting new connections.
func (s *SOCKS5Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	if s.listener != nil {
		return s.listener.Close()
	}
	return nil
}

func (s *SOCKS5Server) handleConn(conn net.Conn) {
	defer conn.Close()

	// Phase 1: Greeting (version + methods).
	authMethod, err := s.handleGreeting(conn)
	if err != nil {
		return
	}

	// Phase 2: Authentication.
	platName, account, authErr := s.handleAuth(conn, authMethod)
	if authErr != nil {
		return
	}

	// Start request lifecycle only after authentication succeeds to avoid
	// unauthenticated noise traffic filling the request-log queue.
	lifecycle := newSOCKS5RequestLifecycle(s.events, conn.RemoteAddr().String())
	defer lifecycle.finish()
	lifecycle.setAccount(account)

	// Phase 3: Request.
	target, err := s.handleRequest(conn, platName, account)
	if err != nil {
		lifecycle.setUpstreamError(socks5StageRequest, err)
		return
	}
	lifecycle.setTarget(target, "")

	// Phase 4: Route + Tunnel.
	s.handleTunnel(conn, lifecycle, platName, account, target)
}

// handleGreeting reads the SOCKS5 greeting and selects an authentication method.
func (s *SOCKS5Server) handleGreeting(conn net.Conn) (byte, error) {
	// VER + NMETHODS
	header := make([]byte, 2)
	if _, err := io.ReadFull(conn, header); err != nil {
		return 0, err
	}
	if header[0] != socks5Version {
		return 0, fmt.Errorf("unsupported socks version: %d", header[0])
	}
	nMethods := int(header[1])
	if nMethods == 0 {
		conn.Write([]byte{socks5Version, socks5AuthNoAcceptable})
		return 0, fmt.Errorf("no auth methods offered")
	}

	methods := make([]byte, nMethods)
	if _, err := io.ReadFull(conn, methods); err != nil {
		return 0, err
	}

	// Select auth method based on configuration.
	if s.token == "" {
		// No token configured: prefer username/password for identity extraction,
		// but accept no-auth as well.
		for _, m := range methods {
			if m == socks5AuthUsernamePassword {
				conn.Write([]byte{socks5Version, socks5AuthUsernamePassword})
				return socks5AuthUsernamePassword, nil
			}
		}
		for _, m := range methods {
			if m == socks5AuthNone {
				conn.Write([]byte{socks5Version, socks5AuthNone})
				return socks5AuthNone, nil
			}
		}
	} else {
		// Token configured: require username/password.
		for _, m := range methods {
			if m == socks5AuthUsernamePassword {
				conn.Write([]byte{socks5Version, socks5AuthUsernamePassword})
				return socks5AuthUsernamePassword, nil
			}
		}
	}

	conn.Write([]byte{socks5Version, socks5AuthNoAcceptable})
	return 0, fmt.Errorf("no acceptable auth method")
}

// handleAuth performs authentication sub-negotiation and returns (platform, account, error).
func (s *SOCKS5Server) handleAuth(conn net.Conn, method byte) (string, string, error) {
	if method == socks5AuthNone {
		return "", "", nil
	}

	// RFC 1929: username/password sub-negotiation.
	// VER(1) | ULEN(1) | UNAME(ULEN) | PLEN(1) | PASSWD(PLEN)
	ver := make([]byte, 1)
	if _, err := io.ReadFull(conn, ver); err != nil {
		return "", "", err
	}
	if ver[0] != socks5AuthUPVersion {
		conn.Write([]byte{socks5AuthUPVersion, socks5AuthUPFailure})
		return "", "", fmt.Errorf("unsupported auth sub-version: %d", ver[0])
	}

	ulenBuf := make([]byte, 1)
	if _, err := io.ReadFull(conn, ulenBuf); err != nil {
		return "", "", err
	}
	username := make([]byte, ulenBuf[0])
	if len(username) > 0 {
		if _, err := io.ReadFull(conn, username); err != nil {
			return "", "", err
		}
	}

	plenBuf := make([]byte, 1)
	if _, err := io.ReadFull(conn, plenBuf); err != nil {
		return "", "", err
	}
	password := make([]byte, plenBuf[0])
	if len(password) > 0 {
		if _, err := io.ReadFull(conn, password); err != nil {
			return "", "", err
		}
	}

	platName, account, ok := s.authenticateSOCKS5(string(username), string(password))
	if !ok {
		conn.Write([]byte{socks5AuthUPVersion, socks5AuthUPFailure})
		return "", "", fmt.Errorf("socks5 auth failed")
	}

	conn.Write([]byte{socks5AuthUPVersion, socks5AuthUPSuccess})
	return platName, account, nil
}

// authenticateSOCKS5 maps SOCKS5 username/password to (platform, account, ok).
//
// Mapping rules:
//
//	V1:        username = "Platform.Account", password = "TOKEN"
//	LEGACY_V0: username = "TOKEN",            password = "Platform:Account"
//	Token="":  username = identity (optional), password ignored
func (s *SOCKS5Server) authenticateSOCKS5(username, password string) (string, string, bool) {
	if s.token == "" {
		// Auth disabled: extract identity from username if present.
		if username == "" {
			return "", "", true
		}
		if s.authVersion == config.AuthVersionV1 {
			platName, account := parseV1PlatformAccountIdentity(username)
			return platName, account, true
		}
		platName, account := parseLegacyPlatformAccountIdentity(username)
		return platName, account, true
	}

	if s.authVersion == config.AuthVersionV1 {
		// V1: username = "Platform.Account", password = "TOKEN"
		if password != s.token {
			return "", "", false
		}
		platName, account := parseV1PlatformAccountIdentity(username)
		return platName, account, true
	}

	// LEGACY_V0: username = "TOKEN", password = "Platform:Account"
	if username != s.token {
		return "", "", false
	}
	platName, account := parseLegacyPlatformAccountIdentity(password)
	return platName, account, true
}

// handleRequest reads the SOCKS5 request and returns the target address.
// Only CONNECT (CMD=0x01) is supported.
func (s *SOCKS5Server) handleRequest(conn net.Conn, platName, account string) (string, error) {
	// VER(1) | CMD(1) | RSV(1) | ATYP(1)
	header := make([]byte, 4)
	if _, err := io.ReadFull(conn, header); err != nil {
		return "", err
	}
	if header[0] != socks5Version {
		return "", fmt.Errorf("unexpected version in request: %d", header[0])
	}

	cmd := header[1]
	atyp := header[3]

	// Parse destination address.
	var host string
	switch atyp {
	case socks5AtypIPv4:
		addr := make([]byte, 4)
		if _, err := io.ReadFull(conn, addr); err != nil {
			return "", err
		}
		host = net.IP(addr).String()
	case socks5AtypDomain:
		lenBuf := make([]byte, 1)
		if _, err := io.ReadFull(conn, lenBuf); err != nil {
			return "", err
		}
		domain := make([]byte, lenBuf[0])
		if _, err := io.ReadFull(conn, domain); err != nil {
			return "", err
		}
		host = string(domain)
	case socks5AtypIPv6:
		addr := make([]byte, 16)
		if _, err := io.ReadFull(conn, addr); err != nil {
			return "", err
		}
		host = net.IP(addr).String()
	default:
		s.sendReply(conn, socks5RepAddressTypeNotSupported, nil, 0)
		return "", fmt.Errorf("unsupported address type: %d", atyp)
	}

	// Parse port.
	portBuf := make([]byte, 2)
	if _, err := io.ReadFull(conn, portBuf); err != nil {
		return "", err
	}
	port := binary.BigEndian.Uint16(portBuf)
	target := net.JoinHostPort(host, strconv.Itoa(int(port)))

	// Only CONNECT is supported.
	if cmd != socks5CmdConnect {
		s.sendReply(conn, socks5RepCommandNotSupported, nil, 0)
		return "", fmt.Errorf("unsupported command: %d", cmd)
	}

	return target, nil
}

// handleTunnel performs routing, upstream dial, and bidirectional copy.
func (s *SOCKS5Server) handleTunnel(conn net.Conn, lifecycle *requestLifecycle, platName, account, target string) {
	routed, routeErr := resolveRoutedOutbound(s.router, s.pool, platName, account, target)
	if routeErr != nil {
		lifecycle.setProxyError(routeErr)
		lifecycle.setUpstreamError(socks5StageRoute, errors.New(routeErr.Message))
		s.sendReply(conn, s.mapProxyErrorToReply(routeErr), nil, 0)
		return
	}
	lifecycle.setRouteResult(routed.Route)

	domain := netutil.ExtractDomain(target)
	nodeHashRaw := routed.Route.NodeHash
	go s.health.RecordLatency(nodeHashRaw, domain, nil)

	ctx := context.Background()
	rawConn, err := routed.Outbound.DialContext(ctx, "tcp", M.ParseSocksaddr(target))
	if err != nil {
		proxyErr := classifyConnectError(err)
		if proxyErr == nil {
			lifecycle.setNetOK(true)
			s.sendReply(conn, socks5RepGeneralFailure, nil, 0)
			return
		}
		lifecycle.setProxyError(proxyErr)
		lifecycle.setUpstreamError("socks5_dial", err)
		go s.health.RecordResult(nodeHashRaw, false)
		s.sendReply(conn, s.mapProxyErrorToReply(proxyErr), nil, 0)
		return
	}

	// Wrap with counting conn for traffic/connection metrics.
	var upstreamBase net.Conn = rawConn
	if s.metricsSink != nil {
		s.metricsSink.OnConnectionLifecycle(ConnectionOutbound, ConnectionOpen)
		upstreamBase = newCountingConn(rawConn, s.metricsSink)
	}

	// Wrap with TLS latency measurement.
	upstreamConn := newTLSLatencyConn(upstreamBase, func(latency time.Duration) {
		s.health.RecordLatency(nodeHashRaw, domain, &latency)
	})

	// Send SOCKS5 success reply.
	// Use the local address of the upstream connection as BND.ADDR/BND.PORT.
	bndAddr, bndPort := parseBoundAddress(upstreamConn.LocalAddr())
	s.sendReply(conn, socks5RepSucceeded, bndAddr, bndPort)

	// Bidirectional tunnel.
	type copyResult struct {
		n   int64
		err error
	}
	egressBytesCh := make(chan copyResult, 1)
	go func() {
		defer upstreamConn.Close()
		defer conn.Close()
		n, copyErr := io.Copy(upstreamConn, conn)
		egressBytesCh <- copyResult{n: n, err: copyErr}
	}()
	ingressBytes, ingressCopyErr := io.Copy(conn, upstreamConn)
	lifecycle.addIngressBytes(ingressBytes)
	conn.Close()
	upstreamConn.Close()
	egressResult := <-egressBytesCh
	lifecycle.addEgressBytes(egressResult.n)

	okResult := ingressBytes > 0 && egressResult.n > 0
	if !okResult {
		lifecycle.setProxyError(ErrUpstreamRequestFailed)
		switch {
		case !isBenignTunnelCopyError(ingressCopyErr):
			lifecycle.setUpstreamError("socks5_upstream_to_client_copy", ingressCopyErr)
		case !isBenignTunnelCopyError(egressResult.err):
			lifecycle.setUpstreamError("socks5_client_to_upstream_copy", egressResult.err)
		default:
			switch {
			case ingressBytes == 0 && egressResult.n == 0:
				lifecycle.setUpstreamError("socks5_zero_traffic", nil)
			case ingressBytes == 0:
				lifecycle.setUpstreamError("socks5_no_ingress_traffic", nil)
			default:
				lifecycle.setUpstreamError("socks5_no_egress_traffic", nil)
			}
		}
	}
	lifecycle.setNetOK(okResult)
	go s.health.RecordResult(nodeHashRaw, okResult)
}

// sendReply writes a SOCKS5 reply to the client.
func (s *SOCKS5Server) sendReply(conn net.Conn, rep byte, bindAddr net.IP, bindPort uint16) {
	// VER(1) | REP(1) | RSV(1) | ATYP(1) | BND.ADDR(var) | BND.PORT(2)
	var reply []byte
	if bindAddr == nil {
		// Default: 0.0.0.0:0
		reply = []byte{socks5Version, rep, 0x00, socks5AtypIPv4, 0, 0, 0, 0, 0, 0}
	} else if v4 := bindAddr.To4(); v4 != nil {
		reply = make([]byte, 10)
		reply[0] = socks5Version
		reply[1] = rep
		reply[2] = 0x00
		reply[3] = socks5AtypIPv4
		copy(reply[4:8], v4)
		binary.BigEndian.PutUint16(reply[8:10], bindPort)
	} else {
		reply = make([]byte, 22)
		reply[0] = socks5Version
		reply[1] = rep
		reply[2] = 0x00
		reply[3] = socks5AtypIPv6
		copy(reply[4:20], bindAddr.To16())
		binary.BigEndian.PutUint16(reply[20:22], bindPort)
	}
	conn.Write(reply)
}

// mapProxyErrorToReply maps a ProxyError to a SOCKS5 reply code.
func (s *SOCKS5Server) mapProxyErrorToReply(pe *ProxyError) byte {
	if pe == nil {
		return socks5RepGeneralFailure
	}
	switch pe {
	case ErrAuthRequired, ErrAuthFailed:
		return socks5RepConnectionNotAllowed
	case ErrPlatformNotFound, ErrAccountRejected:
		return socks5RepConnectionNotAllowed
	case ErrNoAvailableNodes:
		return socks5RepHostUnreachable
	case ErrUpstreamConnectFailed:
		return socks5RepConnectionRefused
	case ErrUpstreamTimeout:
		return socks5RepTTLExpired
	default:
		return socks5RepGeneralFailure
	}
}

// parseBoundAddress extracts IP and port from a net.Addr.
func parseBoundAddress(addr net.Addr) (net.IP, uint16) {
	if addr == nil {
		return nil, 0
	}
	s := addr.String()
	host, portStr, err := net.SplitHostPort(s)
	if err != nil {
		return nil, 0
	}
	ip := net.ParseIP(host)
	port, _ := strconv.Atoi(portStr)
	return ip, uint16(port)
}
