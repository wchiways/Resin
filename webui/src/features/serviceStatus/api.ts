import { apiRequest } from "../../lib/api-client";
import type {
  RequestLogQueueStatus,
  ServiceStatusEntry,
  SystemStabilityStatus,
  SystemStatus,
  SystemTimeoutsStatus,
} from "./types";

const emptyServiceStatusEntry: ServiceStatusEntry = {
  enabled: false,
  listen_address: "",
};

const emptyRequestLogQueue: RequestLogQueueStatus = {
  queue_len: 0,
  queue_capacity: 0,
  enqueued_total: 0,
  dropped_total: 0,
  flush_total: 0,
  flush_failed_total: 0,
  flushed_entries_total: 0,
};

const emptyStability: SystemStabilityStatus = {
  proxy_healthy: true,
  traffic_increased: false,
  queue_degraded: false,
  dropped_total: 0,
  dropped_rate: 0,
  cancel_hint: true,
  timeout_hint: true,
};

const emptyTimeouts: SystemTimeoutsStatus = {
  inbound_server_read_header_timeout: "",
  inbound_server_read_timeout: "",
  inbound_server_write_timeout: "",
  inbound_server_idle_timeout: "",
  proxy_transport_dial_timeout: "",
  proxy_transport_tls_handshake_timeout: "",
  proxy_transport_response_header_timeout: "",
  proxy_transport_idle_conn_timeout: "",
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const raw = await apiRequest<Partial<SystemStatus>>("/api/v1/system/status");

  return {
    version: raw.version ?? "",
    git_commit: raw.git_commit ?? "",
    build_time: raw.build_time ?? "",
    started_at: raw.started_at ?? "",
    uptime_seconds: raw.uptime_seconds ?? 0,
    http_proxy: raw.http_proxy ?? emptyServiceStatusEntry,
    socks5_proxy: raw.socks5_proxy ?? emptyServiceStatusEntry,
    memory: raw.memory ?? {
      alloc_bytes: 0,
      sys_bytes: 0,
      heap_alloc_bytes: 0,
      num_gc: 0,
    },
    traffic: raw.traffic ?? {
      total_ingress_bytes: 0,
      total_egress_bytes: 0,
    },
    request_log_queue: raw.request_log_queue ?? emptyRequestLogQueue,
    stability: raw.stability ?? emptyStability,
    timeouts: raw.timeouts ?? emptyTimeouts,
  };
}
