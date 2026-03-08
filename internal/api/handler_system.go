package api

import (
	"fmt"
	"net/http"
	"runtime"
	"sync/atomic"
	"time"

	"github.com/Resinat/Resin/internal/config"
	"github.com/Resinat/Resin/internal/metrics"
	"github.com/Resinat/Resin/internal/requestlog"
	"github.com/Resinat/Resin/internal/service"
)

type systemEnvConfigResponse struct {
	CacheDir                                        string          `json:"cache_dir"`
	StateDir                                        string          `json:"state_dir"`
	LogDir                                          string          `json:"log_dir"`
	ListenAddress                                   string          `json:"listen_address"`
	ResinPort                                       int             `json:"resin_port"`
	APIMaxBodyBytes                                 int             `json:"api_max_body_bytes"`
	MaxLatencyTableEntries                          int             `json:"max_latency_table_entries"`
	ProbeConcurrency                                int             `json:"probe_concurrency"`
	GeoIPUpdateSchedule                             string          `json:"geoip_update_schedule"`
	DefaultPlatformStickyTTL                        config.Duration `json:"default_platform_sticky_ttl"`
	DefaultPlatformRegexFilters                     []string        `json:"default_platform_regex_filters"`
	DefaultPlatformRegionFilters                    []string        `json:"default_platform_region_filters"`
	DefaultPlatformReverseProxyMissAction           string          `json:"default_platform_reverse_proxy_miss_action"`
	DefaultPlatformReverseProxyEmptyAccountBehavior string          `json:"default_platform_reverse_proxy_empty_account_behavior"`
	DefaultPlatformReverseProxyFixedAccountHeader   string          `json:"default_platform_reverse_proxy_fixed_account_header"`
	DefaultPlatformAllocationPolicy                 string          `json:"default_platform_allocation_policy"`
	ProbeTimeout                                    config.Duration `json:"probe_timeout"`
	ResourceFetchTimeout                            config.Duration `json:"resource_fetch_timeout"`
	ProxyTransportMaxIdleConns                      int             `json:"proxy_transport_max_idle_conns"`
	ProxyTransportMaxIdleConnsPerHost               int             `json:"proxy_transport_max_idle_conns_per_host"`
	ProxyTransportIdleConnTimeout                   config.Duration `json:"proxy_transport_idle_conn_timeout"`
	RequestLogQueueSize                             int             `json:"request_log_queue_size"`
	RequestLogQueueFlushBatchSize                   int             `json:"request_log_queue_flush_batch_size"`
	RequestLogQueueFlushInterval                    config.Duration `json:"request_log_queue_flush_interval"`
	RequestLogDBMaxMB                               int             `json:"request_log_db_max_mb"`
	RequestLogDBRetainCount                         int             `json:"request_log_db_retain_count"`
	MetricThroughputIntervalSeconds                 int             `json:"metric_throughput_interval_seconds"`
	MetricThroughputRetentionSeconds                int             `json:"metric_throughput_retention_seconds"`
	MetricBucketSeconds                             int             `json:"metric_bucket_seconds"`
	MetricConnectionsIntervalSeconds                int             `json:"metric_connections_interval_seconds"`
	MetricConnectionsRetentionSeconds               int             `json:"metric_connections_retention_seconds"`
	MetricLeasesIntervalSeconds                     int             `json:"metric_leases_interval_seconds"`
	MetricLeasesRetentionSeconds                    int             `json:"metric_leases_retention_seconds"`
	MetricLatencyBinWidthMS                         int             `json:"metric_latency_bin_width_ms"`
	MetricLatencyBinOverflowMS                      int             `json:"metric_latency_bin_overflow_ms"`
	AdminTokenSet                                   bool            `json:"admin_token_set"`
	ProxyTokenSet                                   bool            `json:"proxy_token_set"`
	AdminTokenWeak                                  bool            `json:"admin_token_weak"`
	ProxyTokenWeak                                  bool            `json:"proxy_token_weak"`
	ProxyToken                                      string          `json:"proxy_token"`
}

// HandleSystemInfo returns a handler for GET /api/v1/system/info.
func HandleSystemInfo(info service.SystemInfo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, info)
	}
}

// HandleSystemConfig returns a handler for GET /api/v1/system/config.
func HandleSystemConfig(runtimeCfg *atomic.Pointer[config.RuntimeConfig]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if runtimeCfg == nil {
			WriteJSON(w, http.StatusOK, nil)
			return
		}
		WriteJSON(w, http.StatusOK, runtimeCfg.Load())
	}
}

// HandleSystemDefaultConfig returns a handler for GET /api/v1/system/config/default.
func HandleSystemDefaultConfig() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, config.NewDefaultRuntimeConfig())
	}
}

// HandleSystemEnvConfig returns a handler for GET /api/v1/system/config/env.
func HandleSystemEnvConfig(envCfg *config.EnvConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, systemEnvConfigSnapshot(envCfg))
	}
}

// HandlePatchSystemConfig returns a handler for PATCH /api/v1/system/config.
func HandlePatchSystemConfig(cp *service.ControlPlaneService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, ok := readRawBodyOrWriteInvalid(w, r)
		if !ok {
			return
		}
		result, err := cp.PatchRuntimeConfig(body)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		WriteJSON(w, http.StatusOK, result)
	}
}

func systemEnvConfigSnapshot(envCfg *config.EnvConfig) *systemEnvConfigResponse {
	if envCfg == nil {
		return nil
	}
	adminTokenSet := envCfg.AdminToken != ""
	proxyTokenSet := envCfg.ProxyToken != ""
	return &systemEnvConfigResponse{
		CacheDir:                              envCfg.CacheDir,
		StateDir:                              envCfg.StateDir,
		LogDir:                                envCfg.LogDir,
		ListenAddress:                         envCfg.ListenAddress,
		ResinPort:                             envCfg.ResinPort,
		APIMaxBodyBytes:                       envCfg.APIMaxBodyBytes,
		MaxLatencyTableEntries:                envCfg.MaxLatencyTableEntries,
		ProbeConcurrency:                      envCfg.ProbeConcurrency,
		GeoIPUpdateSchedule:                   envCfg.GeoIPUpdateSchedule,
		DefaultPlatformStickyTTL:              config.Duration(envCfg.DefaultPlatformStickyTTL),
		DefaultPlatformRegexFilters:           append([]string(nil), envCfg.DefaultPlatformRegexFilters...),
		DefaultPlatformRegionFilters:          append([]string(nil), envCfg.DefaultPlatformRegionFilters...),
		DefaultPlatformReverseProxyMissAction: envCfg.DefaultPlatformReverseProxyMissAction,
		DefaultPlatformReverseProxyEmptyAccountBehavior: envCfg.DefaultPlatformReverseProxyEmptyAccountBehavior,
		DefaultPlatformReverseProxyFixedAccountHeader:   envCfg.DefaultPlatformReverseProxyFixedAccountHeader,
		DefaultPlatformAllocationPolicy:                 envCfg.DefaultPlatformAllocationPolicy,
		ProbeTimeout:                                    config.Duration(envCfg.ProbeTimeout),
		ResourceFetchTimeout:                            config.Duration(envCfg.ResourceFetchTimeout),
		ProxyTransportMaxIdleConns:                      envCfg.ProxyTransportMaxIdleConns,
		ProxyTransportMaxIdleConnsPerHost:               envCfg.ProxyTransportMaxIdleConnsPerHost,
		ProxyTransportIdleConnTimeout:                   config.Duration(envCfg.ProxyTransportIdleConnTimeout),
		RequestLogQueueSize:                             envCfg.RequestLogQueueSize,
		RequestLogQueueFlushBatchSize:                   envCfg.RequestLogQueueFlushBatchSize,
		RequestLogQueueFlushInterval:                    config.Duration(envCfg.RequestLogQueueFlushInterval),
		RequestLogDBMaxMB:                               envCfg.RequestLogDBMaxMB,
		RequestLogDBRetainCount:                         envCfg.RequestLogDBRetainCount,
		MetricThroughputIntervalSeconds:                 envCfg.MetricThroughputIntervalSeconds,
		MetricThroughputRetentionSeconds:                envCfg.MetricThroughputRetentionSeconds,
		MetricBucketSeconds:                             envCfg.MetricBucketSeconds,
		MetricConnectionsIntervalSeconds:                envCfg.MetricConnectionsIntervalSeconds,
		MetricConnectionsRetentionSeconds:               envCfg.MetricConnectionsRetentionSeconds,
		MetricLeasesIntervalSeconds:                     envCfg.MetricLeasesIntervalSeconds,
		MetricLeasesRetentionSeconds:                    envCfg.MetricLeasesRetentionSeconds,
		MetricLatencyBinWidthMS:                         envCfg.MetricLatencyBinWidthMS,
		MetricLatencyBinOverflowMS:                      envCfg.MetricLatencyBinOverflowMS,
		AdminTokenSet:                                   adminTokenSet,
		ProxyTokenSet:                                   proxyTokenSet,
		AdminTokenWeak:                                  adminTokenSet && config.IsWeakToken(envCfg.AdminToken),
		ProxyTokenWeak:                                  proxyTokenSet && config.IsWeakToken(envCfg.ProxyToken),
		ProxyToken:                                      envCfg.ProxyToken,
	}
}

type systemStatusResponse struct {
	Version       string `json:"version"`
	GitCommit     string `json:"git_commit"`
	BuildTime     string `json:"build_time"`
	StartedAt     string `json:"started_at"`
	UptimeSeconds int64  `json:"uptime_seconds"`

	HTTPProxy   serviceStatusEntry `json:"http_proxy"`
	SOCKS5Proxy serviceStatusEntry `json:"socks5_proxy"`

	Memory          memoryStatus              `json:"memory"`
	Traffic         trafficStatus             `json:"traffic"`
	RequestLogQueue requestLogQueueStatus     `json:"request_log_queue"`
	Stability       systemStabilityStatus     `json:"stability"`
	Timeouts        systemTimeoutConfigStatus `json:"timeouts"`
}

type serviceStatusEntry struct {
	Enabled       bool   `json:"enabled"`
	ListenAddress string `json:"listen_address"`
}

type memoryStatus struct {
	AllocBytes     uint64 `json:"alloc_bytes"`
	SysBytes       uint64 `json:"sys_bytes"`
	HeapAllocBytes uint64 `json:"heap_alloc_bytes"`
	NumGC          uint32 `json:"num_gc"`
}

type trafficStatus struct {
	TotalIngressBytes int64 `json:"total_ingress_bytes"`
	TotalEgressBytes  int64 `json:"total_egress_bytes"`
}

type requestLogQueueStatus struct {
	QueueLen            int   `json:"queue_len"`
	QueueCapacity       int   `json:"queue_capacity"`
	EnqueuedTotal       int64 `json:"enqueued_total"`
	DroppedTotal        int64 `json:"dropped_total"`
	FlushTotal          int64 `json:"flush_total"`
	FlushFailedTotal    int64 `json:"flush_failed_total"`
	FlushedEntriesTotal int64 `json:"flushed_entries_total"`
}

type systemStabilityStatus struct {
	ProxyHealthy     bool  `json:"proxy_healthy"`
	TrafficIncreased bool  `json:"traffic_increased"`
	QueueDegraded    bool  `json:"queue_degraded"`
	DroppedTotal     int64 `json:"dropped_total"`
	DroppedRate      int64 `json:"dropped_rate"`
	CancelHint       bool  `json:"cancel_hint"`
	TimeoutHint      bool  `json:"timeout_hint"`
}

type systemTimeoutConfigStatus struct {
	InboundServerReadHeaderTimeout      config.Duration `json:"inbound_server_read_header_timeout"`
	InboundServerReadTimeout            config.Duration `json:"inbound_server_read_timeout"`
	InboundServerWriteTimeout           config.Duration `json:"inbound_server_write_timeout"`
	InboundServerIdleTimeout            config.Duration `json:"inbound_server_idle_timeout"`
	ProxyTransportDialTimeout           config.Duration `json:"proxy_transport_dial_timeout"`
	ProxyTransportTLSHandshakeTimeout   config.Duration `json:"proxy_transport_tls_handshake_timeout"`
	ProxyTransportResponseHeaderTimeout config.Duration `json:"proxy_transport_response_header_timeout"`
	ProxyTransportIdleConnTimeout       config.Duration `json:"proxy_transport_idle_conn_timeout"`
}

// HandleSystemStatus returns a handler for GET /api/v1/system/status.
func HandleSystemStatus(
	info service.SystemInfo,
	envCfg *config.EnvConfig,
	metricsManager *metrics.Manager,
	requestlogSvc *requestlog.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var ms runtime.MemStats
		runtime.ReadMemStats(&ms)

		snap := metricsManager.Collector().Snapshot()

		socks5Enabled := envCfg.Socks5Port != 0
		var socks5Addr string
		if socks5Enabled {
			socks5Addr = fmt.Sprintf("%s:%d", envCfg.ListenAddress, envCfg.Socks5Port)
		}

		requestLogQueue := requestLogQueueStatus{}
		if requestlogSvc != nil {
			stats := requestlogSvc.StatsSnapshot()
			requestLogQueue = requestLogQueueStatus{
				QueueLen:            stats.QueueLen,
				QueueCapacity:       stats.QueueCapacity,
				EnqueuedTotal:       stats.EnqueuedTotal,
				DroppedTotal:        stats.DroppedTotal,
				FlushTotal:          stats.FlushTotal,
				FlushFailedTotal:    stats.FlushFailedTotal,
				FlushedEntriesTotal: stats.FlushedEntriesTotal,
			}
		}

		resp := systemStatusResponse{
			Version:       info.Version,
			GitCommit:     info.GitCommit,
			BuildTime:     info.BuildTime,
			StartedAt:     info.StartedAt.Format(time.RFC3339),
			UptimeSeconds: int64(time.Since(info.StartedAt).Seconds()),
			HTTPProxy: serviceStatusEntry{
				Enabled:       true,
				ListenAddress: fmt.Sprintf("%s:%d", envCfg.ListenAddress, envCfg.ResinPort),
			},
			SOCKS5Proxy: serviceStatusEntry{
				Enabled:       socks5Enabled,
				ListenAddress: socks5Addr,
			},
			Memory: memoryStatus{
				AllocBytes:     ms.Alloc,
				SysBytes:       ms.Sys,
				HeapAllocBytes: ms.HeapAlloc,
				NumGC:          ms.NumGC,
			},
			Traffic: trafficStatus{
				TotalIngressBytes: snap.IngressBytes,
				TotalEgressBytes:  snap.EgressBytes,
			},
			RequestLogQueue: requestLogQueue,
			Stability: systemStabilityStatus{
				ProxyHealthy:     true,
				TrafficIncreased: snap.IngressBytes > 0 || snap.EgressBytes > 0,
				QueueDegraded:    requestLogQueue.DroppedTotal > 0,
				DroppedTotal:     requestLogQueue.DroppedTotal,
				DroppedRate:      droppedRate(requestLogQueue.DroppedTotal, requestLogQueue.EnqueuedTotal),
				CancelHint:       true,
				TimeoutHint:      true,
			},
			Timeouts: systemTimeoutConfigStatus{
				InboundServerReadHeaderTimeout:      config.Duration(envCfg.InboundServerReadHeaderTimeout),
				InboundServerReadTimeout:            config.Duration(envCfg.InboundServerReadTimeout),
				InboundServerWriteTimeout:           config.Duration(envCfg.InboundServerWriteTimeout),
				InboundServerIdleTimeout:            config.Duration(envCfg.InboundServerIdleTimeout),
				ProxyTransportDialTimeout:           config.Duration(envCfg.ProxyTransportDialTimeout),
				ProxyTransportTLSHandshakeTimeout:   config.Duration(envCfg.ProxyTransportTLSHandshakeTimeout),
				ProxyTransportResponseHeaderTimeout: config.Duration(envCfg.ProxyTransportResponseHeaderTimeout),
				ProxyTransportIdleConnTimeout:       config.Duration(envCfg.ProxyTransportIdleConnTimeout),
			},
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

func droppedRate(droppedTotal int64, enqueuedTotal int64) int64 {
	if enqueuedTotal <= 0 {
		if droppedTotal > 0 {
			return 100
		}
		return 0
	}
	total := droppedTotal + enqueuedTotal
	if total <= 0 {
		return 0
	}
	return droppedTotal * 100 / total
}
