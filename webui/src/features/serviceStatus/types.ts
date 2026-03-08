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

export type ServiceStatusCardId = "http_proxy" | "socks5_proxy" | "stability" | "version" | "resource";

export type ServiceStatusCardCategory = "proxy" | "system" | "runtime";

export type ServiceStatusCardHealth = "healthy" | "degraded" | "disabled";

export interface ServiceStatusCardMetric {
  key: string;
  value: number | string;
  unit?: "count" | "bytes" | "percent" | "duration" | "address";
}

export interface ServiceStatusCardModel {
  id: ServiceStatusCardId;
  category: ServiceStatusCardCategory;
  health: ServiceStatusCardHealth;
  title_key: string;
  status_key: string;
  searchable_text: string;
  metrics: ServiceStatusCardMetric[];
}

export interface ServiceStatusDerivedMetrics {
  timestamp: number;
  queue_usage_rate: number;
  heap_usage_rate: number;
  dropped_rate: number;
  dropped_total_delta: number;
  flush_failed_delta: number;
  ingress_bps: number;
  egress_bps: number;
  traffic_total_delta_bytes: number;
}

export interface ServiceStatusSnapshot {
  timestamp: number;
  iso_time: string;
  status: SystemStatus;
  derived: ServiceStatusDerivedMetrics;
}

export type ServiceStatusTrendMetricKey =
  | "queue_usage_rate"
  | "dropped_rate"
  | "ingress_bps"
  | "egress_bps"
  | "heap_usage_rate";

export type ServiceStatusTrendUnit = "percent" | "bytes_per_second";

export interface ServiceStatusTrendPoint {
  timestamp: number;
  iso_time: string;
  value: number;
}

export interface ServiceStatusTrendSeries {
  metric: ServiceStatusTrendMetricKey;
  unit: ServiceStatusTrendUnit;
  points: ServiceStatusTrendPoint[];
  latest: number;
  minimum: number;
  maximum: number;
}

export type ServiceStatusAlertLevel = "info" | "warning" | "critical";

export type ServiceStatusAlertState = "active" | "resolved";

export type ServiceStatusAlertCode =
  | "proxy_unhealthy"
  | "queue_degraded"
  | "queue_usage_high"
  | "drop_rate_high"
  | "memory_pressure_high"
  | "flush_failure_increased";

export interface ServiceStatusAlert {
  code: ServiceStatusAlertCode;
  level: ServiceStatusAlertLevel;
  state: ServiceStatusAlertState;
  message_key: string;
  target_card_ids: ServiceStatusCardId[];
  triggered_at: string;
  updated_at: string;
  resolved_at?: string;
  value?: number;
  threshold?: number;
}

export type ServiceStatusAlertTransitionType = "raised" | "escalated" | "deescalated" | "continued" | "resolved";

export interface ServiceStatusAlertTransition {
  code: ServiceStatusAlertCode;
  type: ServiceStatusAlertTransitionType;
  at: string;
  previous_level?: ServiceStatusAlertLevel;
  next_level?: ServiceStatusAlertLevel;
}

export type ServiceStatusTimeWindowKey = "5m" | "15m" | "1h" | "6h";

export interface ServiceStatusTimeWindowOption {
  key: ServiceStatusTimeWindowKey;
  window_ms: number;
  refresh_ms: number;
  max_points: number;
}

export interface ServiceStatusFilters {
  keyword: string;
  category: ServiceStatusCardCategory | "all";
  health: ServiceStatusCardHealth | "all";
  alert_level: ServiceStatusAlertLevel | "all";
  only_alerting: boolean;
}

export interface ServiceStatusControllerActions {
  setTimeWindow: (next: ServiceStatusTimeWindowKey) => void;
  setFilters: (patch: Partial<ServiceStatusFilters>) => void;
  resetFilters: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  toggleAutoRefresh: () => void;
  refresh: () => Promise<void>;
  copySnapshot: () => Promise<boolean>;
}

export interface ServiceStatusControllerResult {
  snapshot: ServiceStatusSnapshot | undefined;
  history: ServiceStatusSnapshot[];
  filteredCards: ServiceStatusCardModel[];
  trendSeries: ServiceStatusTrendSeries[];
  alerts: ServiceStatusAlert[];
  alertTransitions: ServiceStatusAlertTransition[];
  filters: ServiceStatusFilters;
  timeWindow: ServiceStatusTimeWindowOption;
  timeWindowOptions: ServiceStatusTimeWindowOption[];
  autoRefreshEnabled: boolean;
  query: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    dataUpdatedAt: number;
  };
  actions: ServiceStatusControllerActions;
}
