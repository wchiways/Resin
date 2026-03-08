package proxy

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/puzpuzpuz/xsync/v4"
	"github.com/Resinat/Resin/internal/node"
	"github.com/sagernet/sing-box/adapter"
	M "github.com/sagernet/sing/common/metadata"
)

type OutboundTransportConfig struct {
	DialTimeout           time.Duration
	TLSHandshakeTimeout   time.Duration
	ResponseHeaderTimeout time.Duration
	MaxIdleConns          int
	MaxIdleConnsPerHost   int
	MaxConnsPerHost       int
	IdleConnTimeout       time.Duration
}

const (
	defaultTransportDialTimeout           = 15 * time.Second
	defaultTransportTLSHandshakeTimeout   = 10 * time.Second
	defaultTransportResponseHeaderTimeout = 30 * time.Second
	defaultTransportMaxIdleConns          = 1024
	defaultTransportMaxIdleConnsPerHost   = 64
	defaultTransportMaxConnsPerHost       = 256
	defaultTransportIdleConnTimeout       = 90 * time.Second
)

func normalizeOutboundTransportConfig(cfg OutboundTransportConfig) OutboundTransportConfig {
	if cfg.DialTimeout <= 0 {
		cfg.DialTimeout = defaultTransportDialTimeout
	}
	if cfg.TLSHandshakeTimeout <= 0 {
		cfg.TLSHandshakeTimeout = defaultTransportTLSHandshakeTimeout
	}
	if cfg.ResponseHeaderTimeout <= 0 {
		cfg.ResponseHeaderTimeout = defaultTransportResponseHeaderTimeout
	}
	if cfg.MaxIdleConns <= 0 {
		cfg.MaxIdleConns = defaultTransportMaxIdleConns
	}
	if cfg.MaxIdleConnsPerHost <= 0 {
		cfg.MaxIdleConnsPerHost = defaultTransportMaxIdleConnsPerHost
	}
	if cfg.MaxConnsPerHost <= 0 {
		cfg.MaxConnsPerHost = defaultTransportMaxConnsPerHost
	}
	if cfg.IdleConnTimeout <= 0 {
		cfg.IdleConnTimeout = defaultTransportIdleConnTimeout
	}
	if cfg.MaxIdleConnsPerHost > cfg.MaxIdleConns {
		cfg.MaxIdleConnsPerHost = cfg.MaxIdleConns
	}
	if cfg.MaxConnsPerHost < cfg.MaxIdleConnsPerHost {
		cfg.MaxConnsPerHost = cfg.MaxIdleConnsPerHost
	}
	return cfg
}

// OutboundTransportPool manages reusable outbound HTTP transports keyed by node hash.
// A single instance should be shared by forward/reverse proxies so keep-alive pools
// are reused and can be evicted on node removal.
type OutboundTransportPool struct {
	config     OutboundTransportConfig
	transports *xsync.Map[node.Hash, *http.Transport]
}

func newOutboundTransportPool() *OutboundTransportPool {
	return NewOutboundTransportPool(OutboundTransportConfig{})
}

func newOutboundTransportPoolWithConfig(cfg OutboundTransportConfig) *OutboundTransportPool {
	return NewOutboundTransportPool(cfg)
}

// NewOutboundTransportPool creates a transport pool with normalized settings.
func NewOutboundTransportPool(cfg OutboundTransportConfig) *OutboundTransportPool {
	return &OutboundTransportPool{
		config:     normalizeOutboundTransportConfig(cfg),
		transports: xsync.NewMap[node.Hash, *http.Transport](),
	}
}

// Get returns a reusable transport for the given node hash.
func (p *OutboundTransportPool) Get(
	hash node.Hash,
	ob adapter.Outbound,
	sink MetricsEventSink,
) *http.Transport {
	transport, _ := p.transports.LoadOrCompute(hash, func() (*http.Transport, bool) {
		return p.newReusableOutboundTransport(ob, sink), false
	})
	return transport
}

// Evict closes idle connections for one node transport and removes it from pool.
func (p *OutboundTransportPool) Evict(hash node.Hash) {
	transport, ok := p.transports.LoadAndDelete(hash)
	if !ok || transport == nil {
		return
	}
	transport.CloseIdleConnections()
}

// CloseAll closes idle connections and clears all pooled transports.
func (p *OutboundTransportPool) CloseAll() {
	p.transports.Range(func(_ node.Hash, transport *http.Transport) bool {
		if transport != nil {
			transport.CloseIdleConnections()
		}
		return true
	})
	p.transports.Clear()
}

func (p *OutboundTransportPool) newReusableOutboundTransport(ob adapter.Outbound, sink MetricsEventSink) *http.Transport {
	return &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			dialCtx, cancel := context.WithTimeout(ctx, p.config.DialTimeout)
			defer cancel()
			conn, err := ob.DialContext(dialCtx, network, M.ParseSocksaddr(addr))
			if err != nil {
				return nil, err
			}
			if sink != nil {
				sink.OnConnectionLifecycle(ConnectionOutbound, ConnectionOpen)
				conn = newCountingConn(conn, sink)
			}
			return conn, nil
		},
		DisableKeepAlives:     false,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   p.config.TLSHandshakeTimeout,
		ResponseHeaderTimeout: p.config.ResponseHeaderTimeout,
		MaxIdleConns:          p.config.MaxIdleConns,
		MaxIdleConnsPerHost:   p.config.MaxIdleConnsPerHost,
		MaxConnsPerHost:       p.config.MaxConnsPerHost,
		IdleConnTimeout:       p.config.IdleConnTimeout,
	}
}
