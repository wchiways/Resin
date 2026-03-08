export interface ServiceStatusEntry {
  enabled: boolean;
  listen_address: string;
}

export interface MemoryStatus {
  alloc_bytes: number;
  sys_bytes: number;
  heap_alloc_bytes: number;
  num_gc: number;
}

export interface TrafficStatus {
  total_ingress_bytes: number;
  total_egress_bytes: number;
}

export interface SystemStabilityStatus {
  proxy_healthy: boolean;
  traffic_increased: boolean;
  queue_degraded: boolean;
  dropped_total: number;
  dropped_rate: number;
  cancel_hint: boolean;
  timeout_hint: boolean;
}

export interface SystemTimeoutsStatus {
  inbound_server_read_header_timeout: string;
  inbound_server_read_timeout: string;
  inbound_server_write_timeout: string;
  inbound_server_idle_timeout: string;
  proxy_transport_dial_timeout: string;
  proxy_transport_tls_handshake_timeout: string;
  proxy_transport_response_header_timeout: string;
  proxy_transport_idle_conn_timeout: string;
}

export interface RequestLogQueueStatus {
  queue_len: number;
  queue_capacity: number;
  enqueued_total: number;
  dropped_total: number;
  flush_total: number;
  flush_failed_total: number;
  flushed_entries_total: number;
}

export interface SystemStatus {
  version: string;
  git_commit: string;
  build_time: string;
  started_at: string;
  uptime_seconds: number;
  http_proxy: ServiceStatusEntry;
  socks5_proxy: ServiceStatusEntry;
  memory: MemoryStatus;
  traffic: TrafficStatus;
  request_log_queue: RequestLogQueueStatus;
  stability: SystemStabilityStatus;
  timeouts: SystemTimeoutsStatus;
}
