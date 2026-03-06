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
}
