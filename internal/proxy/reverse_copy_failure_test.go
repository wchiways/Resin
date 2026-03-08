package proxy

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReverseProxy_MidBodyReset_RecordsCopyFailureStage(t *testing.T) {
	env := newProxyE2EEnv(t)
	emitter := newMockEventEmitter()
	health := &mockHealthRecorder{}

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("upstream does not support hijack")
		}
		conn, brw, err := hijacker.Hijack()
		if err != nil {
			t.Fatalf("upstream hijack: %v", err)
		}
		defer conn.Close()

		_, _ = brw.WriteString("HTTP/1.1 200 OK\r\n")
		_, _ = brw.WriteString("Content-Length: 16\r\n")
		_, _ = brw.WriteString("Connection: close\r\n\r\n")
		_, _ = brw.WriteString("partial")
		_ = brw.Flush()
	}))
	defer upstream.Close()

	host := strings.TrimPrefix(upstream.URL, "http://")
	path := fmt.Sprintf("/tok/plat:acct/http/%s/api/reset", host)

	rp := NewReverseProxy(ReverseProxyConfig{
		ProxyToken:     "tok",
		Router:         env.router,
		Pool:           env.pool,
		PlatformLookup: env.pool,
		Health:         health,
		Events:         emitter,
	})

	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()

	rp.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d (body=%q, resinErr=%q)",
			w.Code, http.StatusOK, w.Body.String(), w.Header().Get("X-Resin-Error"))
	}

	select {
	case logEv := <-emitter.logCh:
		if logEv.UpstreamStage != "reverse_upstream_to_client_copy" {
			t.Fatalf("UpstreamStage: got %q, want %q", logEv.UpstreamStage, "reverse_upstream_to_client_copy")
		}
		if logEv.ResinError != "UPSTREAM_REQUEST_FAILED" {
			t.Fatalf("ResinError: got %q, want %q", logEv.ResinError, "UPSTREAM_REQUEST_FAILED")
		}
		if logEv.NetOK {
			t.Fatal("NetOK: got true, want false")
		}
		if logEv.UpstreamErrMsg == "" {
			t.Fatal("UpstreamErrMsg should be recorded for copy failure")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected reverse log event")
	}

	deadline := time.Now().Add(500 * time.Millisecond)
	for health.resultCalls.Load() == 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if health.resultCalls.Load() == 0 {
		t.Fatal("expected health result to be recorded for mid-body reset")
	}
	if health.lastSuccess.Load() != 0 {
		t.Fatalf("lastSuccess: got %d, want 0", health.lastSuccess.Load())
	}
}

func TestReverseProxy_ClientCanceledDuringBodyCopy_NoFailurePenalty(t *testing.T) {
	env := newProxyE2EEnv(t)
	emitter := newMockEventEmitter()
	health := &mockHealthRecorder{}
	headersSent := make(chan struct{})

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "4096")
		w.WriteHeader(http.StatusOK)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		close(headersSent)
		_, _ = w.Write([]byte(strings.Repeat("x", 512)))
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		<-r.Context().Done()
	}))
	defer upstream.Close()

	host := strings.TrimPrefix(upstream.URL, "http://")
	path := fmt.Sprintf("/tok/plat:acct/http/%s/api/cancel", host)

	rp := NewReverseProxy(ReverseProxyConfig{
		ProxyToken:     "tok",
		Router:         env.router,
		Pool:           env.pool,
		PlatformLookup: env.pool,
		Health:         health,
		Events:         emitter,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		<-headersSent
		cancel()
	}()

	req := httptest.NewRequest(http.MethodGet, path, nil).WithContext(ctx)
	w := httptest.NewRecorder()

	rp.ServeHTTP(w, req)

	select {
	case logEv := <-emitter.logCh:
		if !logEv.NetOK {
			t.Fatal("client-canceled reverse request should log net_ok=true")
		}
		if logEv.UpstreamStage != "" {
			t.Fatalf("UpstreamStage: got %q, want empty", logEv.UpstreamStage)
		}
		if logEv.ResinError != "" {
			t.Fatalf("ResinError: got %q, want empty", logEv.ResinError)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected reverse log event")
	}

	time.Sleep(80 * time.Millisecond)
	if health.resultCalls.Load() != 0 {
		t.Fatalf("client-canceled reverse body copy should not record health result, got %d calls", health.resultCalls.Load())
	}
}

func TestReverseProxy_UpgradePath_UnaffectedByCopyFailureCheck(t *testing.T) {
	env := newProxyE2EEnv(t)
	emitter := newMockEventEmitter()
	health := &mockHealthRecorder{}

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("upstream does not support hijack")
		}
		conn, brw, err := hijacker.Hijack()
		if err != nil {
			t.Fatalf("upstream hijack: %v", err)
		}
		defer conn.Close()

		_, _ = brw.WriteString("HTTP/1.1 101 Switching Protocols\r\n")
		_, _ = brw.WriteString("Connection: Upgrade\r\n")
		_, _ = brw.WriteString("Upgrade: websocket\r\n\r\n")
		if err := brw.Flush(); err != nil {
			t.Fatalf("flush upgrade response: %v", err)
		}

		payload := make([]byte, 4)
		if _, err := io.ReadFull(conn, payload); err != nil {
			t.Fatalf("read tunneled payload: %v", err)
		}
		if _, err := conn.Write([]byte("pong")); err != nil {
			t.Fatalf("write tunneled payload: %v", err)
		}
	}))
	defer upstream.Close()

	rp := NewReverseProxy(ReverseProxyConfig{
		ProxyToken:     "tok",
		Router:         env.router,
		Pool:           env.pool,
		PlatformLookup: env.pool,
		Health:         health,
		Events:         emitter,
	})
	reverseSrv := httptest.NewServer(rp)
	defer reverseSrv.Close()

	reverseAddr := strings.TrimPrefix(reverseSrv.URL, "http://")
	clientConn, err := net.Dial("tcp", reverseAddr)
	if err != nil {
		t.Fatalf("dial reverse proxy: %v", err)
	}
	defer clientConn.Close()

	upstreamHost := strings.TrimPrefix(upstream.URL, "http://")
	req := fmt.Sprintf(
		"GET /tok/plat:acct/http/%s/ws HTTP/1.1\r\nHost: %s\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
		upstreamHost,
		reverseAddr,
	)
	if _, err := clientConn.Write([]byte(req)); err != nil {
		t.Fatalf("write upgrade request: %v", err)
	}

	reader := bufio.NewReader(clientConn)
	statusLine, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("read upgrade status line: %v", err)
	}
	if !strings.Contains(statusLine, "101 Switching Protocols") {
		t.Fatalf("unexpected status line: %q", statusLine)
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatalf("read upgrade headers: %v", err)
		}
		if line == "\r\n" {
			break
		}
	}

	if _, err := clientConn.Write([]byte("ping")); err != nil {
		t.Fatalf("write tunneled payload: %v", err)
	}
	ack := make([]byte, 4)
	if _, err := io.ReadFull(reader, ack); err != nil {
		t.Fatalf("read tunneled payload: %v", err)
	}
	if string(ack) != "pong" {
		t.Fatalf("tunneled payload: got %q, want %q", string(ack), "pong")
	}

	_ = clientConn.Close()

	select {
	case logEv := <-emitter.logCh:
		if logEv.HTTPStatus != http.StatusSwitchingProtocols {
			t.Fatalf("HTTPStatus: got %d, want %d", logEv.HTTPStatus, http.StatusSwitchingProtocols)
		}
		if !logEv.NetOK {
			t.Fatal("NetOK: got false, want true")
		}
		if logEv.UpstreamStage != "" {
			t.Fatalf("UpstreamStage: got %q, want empty", logEv.UpstreamStage)
		}
		if logEv.ResinError != "" {
			t.Fatalf("ResinError: got %q, want empty", logEv.ResinError)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("expected reverse log event for websocket upgrade")
	}

	deadline := time.Now().Add(500 * time.Millisecond)
	for health.resultCalls.Load() == 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if health.resultCalls.Load() == 0 {
		t.Fatal("expected health success result for upgrade request")
	}
	if health.lastSuccess.Load() != 1 {
		t.Fatalf("lastSuccess: got %d, want 1", health.lastSuccess.Load())
	}
}
