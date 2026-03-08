package proxy

import (
	"bytes"
	"io"
	"net"
	"testing"
	"time"
)

func waitSOCKSLogEvent(t *testing.T, emitter *mockEventEmitter) RequestLogEntry {
	t.Helper()
	select {
	case ev := <-emitter.logCh:
		return ev
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SOCKS request log event")
		return RequestLogEntry{}
	}
}

func waitSOCKSFinishedEvent(t *testing.T, emitter *mockEventEmitter) RequestFinishedEvent {
	t.Helper()
	select {
	case ev := <-emitter.finishedCh:
		return ev
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SOCKS finished event")
		return RequestFinishedEvent{}
	}
}

func assertNoExtraSOCKSEvents(t *testing.T, emitter *mockEventEmitter) {
	t.Helper()
	select {
	case ev := <-emitter.logCh:
		t.Fatalf("unexpected extra SOCKS request log event: %+v", ev)
	case <-time.After(50 * time.Millisecond):
	}
	select {
	case ev := <-emitter.finishedCh:
		t.Fatalf("unexpected extra SOCKS finished event: %+v", ev)
	case <-time.After(50 * time.Millisecond):
	}
}

func waitConnDone(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SOCKS connection handler to exit")
	}
}

func TestSOCKS5Lifecycle_GreetingFailureEmitsNoEvents(t *testing.T) {
	emitter := newMockEventEmitter()
	server := NewSOCKS5Server(SOCKS5Config{
		Events: emitter,
	})

	serverConn, clientConn := net.Pipe()
	done := make(chan struct{})
	go func() {
		server.handleConn(serverConn)
		close(done)
	}()

	if _, err := clientConn.Write([]byte{0x04, 0x01}); err != nil {
		t.Fatalf("client write greeting: %v", err)
	}
	_ = clientConn.Close()
	waitConnDone(t, done)

	assertNoExtraSOCKSEvents(t, emitter)
}

func TestSOCKS5Lifecycle_AuthFailureEmitsNoEvents(t *testing.T) {
	emitter := newMockEventEmitter()
	server := NewSOCKS5Server(SOCKS5Config{
		ProxyToken: "expected-token",
		Events:     emitter,
	})

	serverConn, clientConn := net.Pipe()
	done := make(chan struct{})
	go func() {
		server.handleConn(serverConn)
		close(done)
	}()

	if _, err := clientConn.Write([]byte{socks5Version, 1, socks5AuthUsernamePassword}); err != nil {
		t.Fatalf("client write greeting: %v", err)
	}
	greetingReply := make([]byte, 2)
	if _, err := io.ReadFull(clientConn, greetingReply); err != nil {
		t.Fatalf("client read greeting reply: %v", err)
	}
	if !bytes.Equal(greetingReply, []byte{socks5Version, socks5AuthUsernamePassword}) {
		t.Fatalf("greeting reply: got %v, want %v", greetingReply, []byte{socks5Version, socks5AuthUsernamePassword})
	}

	authReq := []byte{socks5AuthUPVersion, 3, 'b', 'a', 'd', 3, 'b', 'a', 'd'}
	if _, err := clientConn.Write(authReq); err != nil {
		t.Fatalf("client write auth request: %v", err)
	}
	authReply := make([]byte, 2)
	if _, err := io.ReadFull(clientConn, authReply); err != nil {
		t.Fatalf("client read auth reply: %v", err)
	}
	if !bytes.Equal(authReply, []byte{socks5AuthUPVersion, socks5AuthUPFailure}) {
		t.Fatalf("auth reply: got %v, want %v", authReply, []byte{socks5AuthUPVersion, socks5AuthUPFailure})
	}

	_ = clientConn.Close()
	waitConnDone(t, done)

	assertNoExtraSOCKSEvents(t, emitter)
}

func TestSOCKS5Lifecycle_LogsRequestFailure(t *testing.T) {
	emitter := newMockEventEmitter()
	server := NewSOCKS5Server(SOCKS5Config{
		Events: emitter,
	})

	serverConn, clientConn := net.Pipe()
	done := make(chan struct{})
	go func() {
		server.handleConn(serverConn)
		close(done)
	}()

	if _, err := clientConn.Write([]byte{socks5Version, 1, socks5AuthNone}); err != nil {
		t.Fatalf("client write greeting: %v", err)
	}
	greetingReply := make([]byte, 2)
	if _, err := io.ReadFull(clientConn, greetingReply); err != nil {
		t.Fatalf("client read greeting reply: %v", err)
	}
	if !bytes.Equal(greetingReply, []byte{socks5Version, socks5AuthNone}) {
		t.Fatalf("greeting reply: got %v, want %v", greetingReply, []byte{socks5Version, socks5AuthNone})
	}

	request := []byte{
		socks5Version,
		socks5CmdBind, // unsupported (only CONNECT is supported)
		0x00,
		socks5AtypIPv4,
		1, 2, 3, 4,
		0, 80,
	}
	if _, err := clientConn.Write(request); err != nil {
		t.Fatalf("client write request: %v", err)
	}
	requestReply := make([]byte, 10)
	if _, err := io.ReadFull(clientConn, requestReply); err != nil {
		t.Fatalf("client read request reply: %v", err)
	}
	if requestReply[0] != socks5Version || requestReply[1] != socks5RepCommandNotSupported {
		t.Fatalf(
			"request reply: got ver=%d rep=%d, want ver=%d rep=%d",
			requestReply[0],
			requestReply[1],
			socks5Version,
			socks5RepCommandNotSupported,
		)
	}

	_ = clientConn.Close()
	waitConnDone(t, done)

	logEv := waitSOCKSLogEvent(t, emitter)
	if logEv.ProxyType != ProxyTypeSOCKS5 {
		t.Fatalf("log ProxyType: got %d, want %d", logEv.ProxyType, ProxyTypeSOCKS5)
	}
	if logEv.UpstreamStage != socks5StageRequest {
		t.Fatalf("log UpstreamStage: got %q, want %q", logEv.UpstreamStage, socks5StageRequest)
	}

	finished := waitSOCKSFinishedEvent(t, emitter)
	if finished.ProxyType != ProxyTypeSOCKS5 {
		t.Fatalf("finished ProxyType: got %d, want %d", finished.ProxyType, ProxyTypeSOCKS5)
	}

	assertNoExtraSOCKSEvents(t, emitter)
}

func TestSOCKS5Lifecycle_LogsRouteFailure(t *testing.T) {
	env := newProxyE2EEnv(t)
	emitter := newMockEventEmitter()
	server := NewSOCKS5Server(SOCKS5Config{
		Router: env.router,
		Pool:   env.pool,
		Health: &mockHealthRecorder{},
		Events: emitter,
	})

	serverConn, clientConn := net.Pipe()
	done := make(chan struct{})
	go func() {
		server.handleConn(serverConn)
		close(done)
	}()

	if _, err := clientConn.Write([]byte{socks5Version, 1, socks5AuthNone}); err != nil {
		t.Fatalf("client write greeting: %v", err)
	}
	greetingReply := make([]byte, 2)
	if _, err := io.ReadFull(clientConn, greetingReply); err != nil {
		t.Fatalf("client read greeting reply: %v", err)
	}
	if !bytes.Equal(greetingReply, []byte{socks5Version, socks5AuthNone}) {
		t.Fatalf("greeting reply: got %v, want %v", greetingReply, []byte{socks5Version, socks5AuthNone})
	}

	request := []byte{
		socks5Version,
		socks5CmdConnect,
		0x00,
		socks5AtypIPv4,
		1, 2, 3, 4,
		0, 80,
	}
	if _, err := clientConn.Write(request); err != nil {
		t.Fatalf("client write request: %v", err)
	}
	requestReply := make([]byte, 10)
	if _, err := io.ReadFull(clientConn, requestReply); err != nil {
		t.Fatalf("client read route-fail reply: %v", err)
	}
	if requestReply[0] != socks5Version || requestReply[1] != socks5RepConnectionNotAllowed {
		t.Fatalf(
			"route-fail reply: got ver=%d rep=%d, want ver=%d rep=%d",
			requestReply[0],
			requestReply[1],
			socks5Version,
			socks5RepConnectionNotAllowed,
		)
	}

	_ = clientConn.Close()
	waitConnDone(t, done)

	logEv := waitSOCKSLogEvent(t, emitter)
	if logEv.ProxyType != ProxyTypeSOCKS5 {
		t.Fatalf("log ProxyType: got %d, want %d", logEv.ProxyType, ProxyTypeSOCKS5)
	}
	if logEv.UpstreamStage != socks5StageRoute {
		t.Fatalf("log UpstreamStage: got %q, want %q", logEv.UpstreamStage, socks5StageRoute)
	}
	if logEv.ResinError != ErrPlatformNotFound.ResinError {
		t.Fatalf("log ResinError: got %q, want %q", logEv.ResinError, ErrPlatformNotFound.ResinError)
	}

	finished := waitSOCKSFinishedEvent(t, emitter)
	if finished.ProxyType != ProxyTypeSOCKS5 {
		t.Fatalf("finished ProxyType: got %d, want %d", finished.ProxyType, ProxyTypeSOCKS5)
	}
	if finished.NetOK {
		t.Fatal("finished NetOK: got true, want false")
	}

	assertNoExtraSOCKSEvents(t, emitter)
}
