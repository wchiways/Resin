import { apiRequest } from "../../lib/api-client";
import type {
  MemoryStatus,
  RequestLogQueueStatus,
  ServiceStatusEntry,
  SystemStabilityStatus,
  SystemStatus,
  SystemTimeoutsStatus,
  TrafficStatus,
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

const emptyMemoryStatus: MemoryStatus = {
  alloc_bytes: 0,
  sys_bytes: 0,
  heap_alloc_bytes: 0,
  num_gc: 0,
};

const emptyTrafficStatus: TrafficStatus = {
  total_ingress_bytes: 0,
  total_egress_bytes: 0,
};

function toNumber(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function toInteger(raw: unknown): number {
  return Math.round(toNumber(raw));
}

function toBoolean(raw: unknown, fallback = false): boolean {
  if (typeof raw === "boolean") {
    return raw;
  }
  return fallback;
}

function toString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function normalizeServiceStatusEntry(raw: unknown): ServiceStatusEntry {
  if (!raw || typeof raw !== "object") {
    return emptyServiceStatusEntry;
  }

  const entry = raw as Partial<ServiceStatusEntry>;
  return {
    enabled: toBoolean(entry.enabled),
    listen_address: toString(entry.listen_address),
  };
}

function normalizeMemoryStatus(raw: unknown): MemoryStatus {
  if (!raw || typeof raw !== "object") {
    return emptyMemoryStatus;
  }

  const memory = raw as Partial<MemoryStatus>;
  return {
    alloc_bytes: toNumber(memory.alloc_bytes),
    sys_bytes: toNumber(memory.sys_bytes),
    heap_alloc_bytes: toNumber(memory.heap_alloc_bytes),
    num_gc: toInteger(memory.num_gc),
  };
}

function normalizeTrafficStatus(raw: unknown): TrafficStatus {
  if (!raw || typeof raw !== "object") {
    return emptyTrafficStatus;
  }

  const traffic = raw as Partial<TrafficStatus>;
  return {
    total_ingress_bytes: toNumber(traffic.total_ingress_bytes),
    total_egress_bytes: toNumber(traffic.total_egress_bytes),
  };
}

function normalizeRequestLogQueue(raw: unknown): RequestLogQueueStatus {
  if (!raw || typeof raw !== "object") {
    return emptyRequestLogQueue;
  }

  const queue = raw as Partial<RequestLogQueueStatus>;
  return {
    queue_len: toInteger(queue.queue_len),
    queue_capacity: toInteger(queue.queue_capacity),
    enqueued_total: toNumber(queue.enqueued_total),
    dropped_total: toNumber(queue.dropped_total),
    flush_total: toNumber(queue.flush_total),
    flush_failed_total: toNumber(queue.flush_failed_total),
    flushed_entries_total: toNumber(queue.flushed_entries_total),
  };
}

function normalizeStability(raw: unknown): SystemStabilityStatus {
  if (!raw || typeof raw !== "object") {
    return emptyStability;
  }

  const stability = raw as Partial<SystemStabilityStatus>;
  return {
    proxy_healthy: toBoolean(stability.proxy_healthy, true),
    traffic_increased: toBoolean(stability.traffic_increased),
    queue_degraded: toBoolean(stability.queue_degraded),
    dropped_total: toNumber(stability.dropped_total),
    dropped_rate: toNumber(stability.dropped_rate),
    cancel_hint: toBoolean(stability.cancel_hint, true),
    timeout_hint: toBoolean(stability.timeout_hint, true),
  };
}

function normalizeTimeouts(raw: unknown): SystemTimeoutsStatus {
  if (!raw || typeof raw !== "object") {
    return emptyTimeouts;
  }

  const timeouts = raw as Partial<SystemTimeoutsStatus>;
  return {
    inbound_server_read_header_timeout: toString(timeouts.inbound_server_read_header_timeout),
    inbound_server_read_timeout: toString(timeouts.inbound_server_read_timeout),
    inbound_server_write_timeout: toString(timeouts.inbound_server_write_timeout),
    inbound_server_idle_timeout: toString(timeouts.inbound_server_idle_timeout),
    proxy_transport_dial_timeout: toString(timeouts.proxy_transport_dial_timeout),
    proxy_transport_tls_handshake_timeout: toString(timeouts.proxy_transport_tls_handshake_timeout),
    proxy_transport_response_header_timeout: toString(timeouts.proxy_transport_response_header_timeout),
    proxy_transport_idle_conn_timeout: toString(timeouts.proxy_transport_idle_conn_timeout),
  };
}

export function normalizeSystemStatus(raw: Partial<SystemStatus> | undefined): SystemStatus {
  return {
    version: toString(raw?.version),
    git_commit: toString(raw?.git_commit),
    build_time: toString(raw?.build_time),
    started_at: toString(raw?.started_at),
    uptime_seconds: toNumber(raw?.uptime_seconds),
    http_proxy: normalizeServiceStatusEntry(raw?.http_proxy),
    socks5_proxy: normalizeServiceStatusEntry(raw?.socks5_proxy),
    memory: normalizeMemoryStatus(raw?.memory),
    traffic: normalizeTrafficStatus(raw?.traffic),
    request_log_queue: normalizeRequestLogQueue(raw?.request_log_queue),
    stability: normalizeStability(raw?.stability),
    timeouts: normalizeTimeouts(raw?.timeouts),
  };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const raw = await apiRequest<Partial<SystemStatus>>("/api/v1/system/status");
  return normalizeSystemStatus(raw);
}
