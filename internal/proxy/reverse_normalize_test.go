package proxy

import "testing"

func TestNormalizeHostPort(t *testing.T) {
	tests := []struct {
		name     string
		host     string
		protocol string
		want     string
	}{
		// HTTPS default port (443) should be removed
		{
			name:     "https with default port 443",
			host:     "example.com:443",
			protocol: "https",
			want:     "example.com",
		},
		{
			name:     "https without port",
			host:     "example.com",
			protocol: "https",
			want:     "example.com",
		},
		{
			name:     "https with non-default port",
			host:     "example.com:8443",
			protocol: "https",
			want:     "example.com:8443",
		},
		// HTTP default port (80) should be removed
		{
			name:     "http with default port 80",
			host:     "example.com:80",
			protocol: "http",
			want:     "example.com",
		},
		{
			name:     "http without port",
			host:     "example.com",
			protocol: "http",
			want:     "example.com",
		},
		{
			name:     "http with non-default port",
			host:     "example.com:8080",
			protocol: "http",
			want:     "example.com:8080",
		},
		// Cross-protocol: port should NOT be removed
		{
			name:     "http with port 443 (not default for http)",
			host:     "example.com:443",
			protocol: "http",
			want:     "example.com:443",
		},
		{
			name:     "https with port 80 (not default for https)",
			host:     "example.com:80",
			protocol: "https",
			want:     "example.com:80",
		},
		// IPv4 addresses
		{
			name:     "ipv4 https with default port",
			host:     "192.168.1.1:443",
			protocol: "https",
			want:     "192.168.1.1",
		},
		{
			name:     "ipv4 http with default port",
			host:     "192.168.1.1:80",
			protocol: "http",
			want:     "192.168.1.1",
		},
		// IPv6 addresses
		{
			name:     "ipv6 https with default port",
			host:     "[::1]:443",
			protocol: "https",
			want:     "[::1]",
		},
		{
			name:     "ipv6 http with default port",
			host:     "[::1]:80",
			protocol: "http",
			want:     "[::1]",
		},
		{
			name:     "ipv6 with non-default port",
			host:     "[::1]:8080",
			protocol: "http",
			want:     "[::1]:8080",
		},
		{
			name:     "ipv6 full address with default port",
			host:     "[2001:db8::1]:443",
			protocol: "https",
			want:     "[2001:db8::1]",
		},
		{
			name:     "ipv6 without port",
			host:     "[::1]",
			protocol: "https",
			want:     "[::1]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeHostPort(tt.host, tt.protocol)
			if got != tt.want {
				t.Errorf("normalizeHostPort(%q, %q) = %q, want %q", tt.host, tt.protocol, got, tt.want)
			}
		})
	}
}
