import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { evaluateServiceStatusAlerts } from "./alertRules";
import { getSystemStatus } from "./api";
import { appendHistory, downsample, pruneHistory, sliceWindow } from "./historyBuffer";
import type {
  ServiceStatusAlert,
  ServiceStatusCardId,
  ServiceStatusCardModel,
  ServiceStatusControllerResult,
  ServiceStatusDerivedMetrics,
  ServiceStatusFilters,
  ServiceStatusSnapshot,
  ServiceStatusTimeWindowKey,
  ServiceStatusTimeWindowOption,
  ServiceStatusTrendMetricKey,
  ServiceStatusTrendSeries,
  SystemStatus,
} from "./types";

const TIME_WINDOW_OPTIONS: ServiceStatusTimeWindowOption[] = [
  { key: "5m", window_ms: 5 * 60 * 1000, refresh_ms: 5_000, max_points: 300 },
  { key: "15m", window_ms: 15 * 60 * 1000, refresh_ms: 5_000, max_points: 360 },
  { key: "1h", window_ms: 60 * 60 * 1000, refresh_ms: 10_000, max_points: 480 },
  { key: "6h", window_ms: 6 * 60 * 60 * 1000, refresh_ms: 30_000, max_points: 600 },
];

const DEFAULT_TIME_WINDOW_KEY: ServiceStatusTimeWindowKey = "15m";
const MAX_ALERT_TRANSITIONS = 256;
const HISTORY_RETENTION_PADDING_MS = 5 * 60 * 1000;
const HISTORY_RETENTION_MS = Math.max(...TIME_WINDOW_OPTIONS.map((item) => item.window_ms)) + HISTORY_RETENTION_PADDING_MS;
const CONTROLLER_QUERY_KEY = ["service-status-controller"] as const;

const EMPTY_HISTORY: ServiceStatusSnapshot[] = [];
const EMPTY_ALERTS: ServiceStatusAlert[] = [];
const EMPTY_CARDS: ServiceStatusCardModel[] = [];
const EMPTY_TREND_SERIES: ServiceStatusTrendSeries[] = [];

const DEFAULT_FILTERS: ServiceStatusFilters = {
  keyword: "",
  category: "all",
  health: "all",
  alert_level: "all",
  only_alerting: false,
};

type ServiceStatusControllerQueryData = {
  snapshot: ServiceStatusSnapshot;
  history: ServiceStatusSnapshot[];
  alerts: ServiceStatusAlert[];
  alertTransitions: ServiceStatusControllerResult["alertTransitions"];
};

function clampUnitRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function counterDelta(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }
  if (current <= previous) {
    return 0;
  }
  return current - previous;
}

function buildDerivedMetrics(
  status: SystemStatus,
  previousSnapshot: ServiceStatusSnapshot | undefined,
  timestamp: number,
): ServiceStatusDerivedMetrics {
  const queueCapacity = status.request_log_queue.queue_capacity;
  const queueUsageRate = queueCapacity > 0 ? status.request_log_queue.queue_len / queueCapacity : 0;

  const heapCapacity = status.memory.sys_bytes;
  const heapUsageRate = heapCapacity > 0 ? status.memory.heap_alloc_bytes / heapCapacity : 0;

  if (!previousSnapshot) {
    return {
      timestamp,
      queue_usage_rate: clampUnitRatio(queueUsageRate),
      heap_usage_rate: clampUnitRatio(heapUsageRate),
      dropped_rate: Math.max(0, status.stability.dropped_rate),
      dropped_total_delta: 0,
      flush_failed_delta: 0,
      ingress_bps: 0,
      egress_bps: 0,
      traffic_total_delta_bytes: 0,
    };
  }

  const elapsedMs = Math.max(1, timestamp - previousSnapshot.timestamp);
  const elapsedSeconds = elapsedMs / 1000;
  const ingressDelta = counterDelta(status.traffic.total_ingress_bytes, previousSnapshot.status.traffic.total_ingress_bytes);
  const egressDelta = counterDelta(status.traffic.total_egress_bytes, previousSnapshot.status.traffic.total_egress_bytes);

  return {
    timestamp,
    queue_usage_rate: clampUnitRatio(queueUsageRate),
    heap_usage_rate: clampUnitRatio(heapUsageRate),
    dropped_rate: Math.max(0, status.stability.dropped_rate),
    dropped_total_delta: counterDelta(status.request_log_queue.dropped_total, previousSnapshot.status.request_log_queue.dropped_total),
    flush_failed_delta: counterDelta(
      status.request_log_queue.flush_failed_total,
      previousSnapshot.status.request_log_queue.flush_failed_total,
    ),
    ingress_bps: ingressDelta / elapsedSeconds,
    egress_bps: egressDelta / elapsedSeconds,
    traffic_total_delta_bytes: ingressDelta + egressDelta,
  };
}

function buildCards(snapshot: ServiceStatusSnapshot): ServiceStatusCardModel[] {
  const { status, derived } = snapshot;
  const queueText = `${status.request_log_queue.queue_len}/${status.request_log_queue.queue_capacity}`;

  return [
    {
      id: "http_proxy",
      category: "proxy",
      health: status.http_proxy.enabled ? "healthy" : "disabled",
      title_key: "HTTP 代理",
      status_key: status.http_proxy.enabled ? "运行中" : "已禁用",
      searchable_text: `http ${status.http_proxy.listen_address}`.toLowerCase(),
      metrics: [{ key: "listen_address", value: status.http_proxy.listen_address || "-", unit: "address" }],
    },
    {
      id: "socks5_proxy",
      category: "proxy",
      health: status.socks5_proxy.enabled ? "healthy" : "disabled",
      title_key: "SOCKS5 代理",
      status_key: status.socks5_proxy.enabled ? "运行中" : "未启用",
      searchable_text: `socks5 ${status.socks5_proxy.listen_address}`.toLowerCase(),
      metrics: [{ key: "listen_address", value: status.socks5_proxy.listen_address || "-", unit: "address" }],
    },
    {
      id: "stability",
      category: "system",
      health: status.stability.queue_degraded || status.stability.dropped_rate >= 10 ? "degraded" : "healthy",
      title_key: "稳定性",
      status_key: status.stability.queue_degraded ? "降级" : "稳定",
      searchable_text: `queue ${queueText} dropped ${status.stability.dropped_rate}`.toLowerCase(),
      metrics: [
        { key: "queue_state", value: queueText, unit: "count" },
        { key: "queue_usage_rate", value: derived.queue_usage_rate * 100, unit: "percent" },
        { key: "dropped_rate", value: status.stability.dropped_rate, unit: "percent" },
        { key: "dropped_total", value: status.stability.dropped_total, unit: "count" },
      ],
    },
    {
      id: "version",
      category: "runtime",
      health: "healthy",
      title_key: "版本信息",
      status_key: status.version ? "已加载" : "未知",
      searchable_text: `${status.version} ${status.git_commit}`.toLowerCase(),
      metrics: [
        { key: "version", value: status.version || "-" },
        { key: "git_commit", value: status.git_commit || "-" },
        { key: "uptime_seconds", value: status.uptime_seconds, unit: "count" },
      ],
    },
    {
      id: "resource",
      category: "runtime",
      health: derived.heap_usage_rate >= 0.95 ? "degraded" : "healthy",
      title_key: "资源使用",
      status_key: derived.heap_usage_rate >= 0.95 ? "高负载" : "正常",
      searchable_text: `${status.memory.heap_alloc_bytes} ${status.memory.sys_bytes} ${status.traffic.total_ingress_bytes} ${status.traffic.total_egress_bytes}`,
      metrics: [
        { key: "heap_alloc_bytes", value: status.memory.heap_alloc_bytes, unit: "bytes" },
        { key: "sys_bytes", value: status.memory.sys_bytes, unit: "bytes" },
        { key: "heap_usage_rate", value: derived.heap_usage_rate * 100, unit: "percent" },
        { key: "num_gc", value: status.memory.num_gc, unit: "count" },
        { key: "total_ingress_bytes", value: status.traffic.total_ingress_bytes, unit: "bytes" },
        { key: "total_egress_bytes", value: status.traffic.total_egress_bytes, unit: "bytes" },
      ],
    },
  ];
}

function indexAlertsByCard(alerts: ServiceStatusAlert[]): Map<ServiceStatusCardId, ServiceStatusAlert[]> {
  const indexed = new Map<ServiceStatusCardId, ServiceStatusAlert[]>();

  for (const alert of alerts) {
    for (const cardId of alert.target_card_ids) {
      const list = indexed.get(cardId) ?? [];
      list.push(alert);
      indexed.set(cardId, list);
    }
  }

  return indexed;
}

function filterCards(
  cards: ServiceStatusCardModel[],
  filters: ServiceStatusFilters,
  scopedAlertsByCard: Map<ServiceStatusCardId, ServiceStatusAlert[]>,
): ServiceStatusCardModel[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return cards.filter((card) => {
    if (filters.category !== "all" && card.category !== filters.category) {
      return false;
    }

    if (filters.health !== "all" && card.health !== filters.health) {
      return false;
    }

    if (keyword) {
      const text = `${card.title_key} ${card.status_key} ${card.searchable_text}`.toLowerCase();
      if (!text.includes(keyword)) {
        return false;
      }
    }

    const hasScopedAlert = (scopedAlertsByCard.get(card.id)?.length ?? 0) > 0;

    if (filters.alert_level !== "all" && !hasScopedAlert) {
      return false;
    }

    if (filters.only_alerting && !hasScopedAlert) {
      return false;
    }

    return true;
  });
}

function buildTrendSeries(history: ServiceStatusSnapshot[]): ServiceStatusTrendSeries[] {
  const metrics: Array<{
    metric: ServiceStatusTrendMetricKey;
    unit: "percent" | "bytes_per_second";
    selector: (snapshot: ServiceStatusSnapshot) => number;
  }> = [
    { metric: "queue_usage_rate", unit: "percent", selector: (snapshot) => snapshot.derived.queue_usage_rate * 100 },
    { metric: "dropped_rate", unit: "percent", selector: (snapshot) => snapshot.derived.dropped_rate },
    { metric: "ingress_bps", unit: "bytes_per_second", selector: (snapshot) => snapshot.derived.ingress_bps },
    { metric: "egress_bps", unit: "bytes_per_second", selector: (snapshot) => snapshot.derived.egress_bps },
    { metric: "heap_usage_rate", unit: "percent", selector: (snapshot) => snapshot.derived.heap_usage_rate * 100 },
  ];

  return metrics.map((item) => {
    const points = history.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      iso_time: snapshot.iso_time,
      value: item.selector(snapshot),
    }));

    if (!points.length) {
      return {
        metric: item.metric,
        unit: item.unit,
        points: [],
        latest: 0,
        minimum: 0,
        maximum: 0,
      };
    }

    const values = points.map((point) => point.value);

    return {
      metric: item.metric,
      unit: item.unit,
      points,
      latest: values[values.length - 1],
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  });
}

function buildControllerQueryData(
  status: SystemStatus,
  previous: ServiceStatusControllerQueryData | undefined,
): ServiceStatusControllerQueryData {
  const timestamp = Date.now();
  const previousSnapshot = previous?.history[previous.history.length - 1];
  const snapshot: ServiceStatusSnapshot = {
    timestamp,
    iso_time: new Date(timestamp).toISOString(),
    status,
    derived: buildDerivedMetrics(status, previousSnapshot, timestamp),
  };

  const nextHistory = pruneHistory(appendHistory(previous?.history ?? EMPTY_HISTORY, snapshot), timestamp - HISTORY_RETENTION_MS);
  const evaluation = evaluateServiceStatusAlerts(snapshot, previous?.alerts ?? EMPTY_ALERTS);
  const mergedTransitions = [...(previous?.alertTransitions ?? []), ...evaluation.transitions];

  return {
    snapshot,
    history: nextHistory,
    alerts: evaluation.alerts,
    alertTransitions:
      mergedTransitions.length <= MAX_ALERT_TRANSITIONS
        ? mergedTransitions
        : mergedTransitions.slice(mergedTransitions.length - MAX_ALERT_TRANSITIONS),
  };
}

export function useServiceStatusController(): ServiceStatusControllerResult {
  const queryClient = useQueryClient();
  const [timeWindowKey, setTimeWindowKey] = useState<ServiceStatusTimeWindowKey>(DEFAULT_TIME_WINDOW_KEY);
  const [filters, setFilters] = useState<ServiceStatusFilters>(DEFAULT_FILTERS);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const timeWindow =
    TIME_WINDOW_OPTIONS.find((item) => item.key === timeWindowKey) ?? TIME_WINDOW_OPTIONS[1];

  const controllerQuery = useQuery({
    queryKey: CONTROLLER_QUERY_KEY,
    queryFn: async () => {
      const previous = queryClient.getQueryData<ServiceStatusControllerQueryData>(CONTROLLER_QUERY_KEY);
      const status = await getSystemStatus();
      return buildControllerQueryData(status, previous);
    },
    refetchInterval: autoRefreshEnabled ? timeWindow.refresh_ms : false,
    placeholderData: (prev) => prev,
  });

  const history = controllerQuery.data?.history ?? EMPTY_HISTORY;
  const activeAlerts = controllerQuery.data?.alerts ?? EMPTY_ALERTS;
  const alertTransitions = controllerQuery.data?.alertTransitions ?? [];

  const windowHistory = useMemo(() => {
    if (!history.length) {
      return EMPTY_HISTORY;
    }
    const now = history[history.length - 1].timestamp;
    return sliceWindow(history, timeWindow.window_ms, now);
  }, [history, timeWindow.window_ms]);

  const sampledHistory = useMemo(() => downsample(windowHistory, timeWindow.max_points), [windowHistory, timeWindow.max_points]);

  const snapshot = sampledHistory[sampledHistory.length - 1] ?? controllerQuery.data?.snapshot;

  const alerts = useMemo(() => {
    if (filters.alert_level === "all") {
      return activeAlerts;
    }
    return activeAlerts.filter((item) => item.level === filters.alert_level);
  }, [activeAlerts, filters.alert_level]);

  const scopedAlertsByCard = useMemo(() => indexAlertsByCard(alerts), [alerts]);

  const allCards = useMemo(() => {
    if (!snapshot) {
      return EMPTY_CARDS;
    }
    return buildCards(snapshot);
  }, [snapshot]);

  const filteredCards = useMemo(
    () => filterCards(allCards, filters, scopedAlertsByCard),
    [allCards, filters, scopedAlertsByCard],
  );

  const trendSeries = useMemo(() => {
    if (!sampledHistory.length) {
      return EMPTY_TREND_SERIES;
    }
    return buildTrendSeries(sampledHistory);
  }, [sampledHistory]);

  const refresh = async () => {
    await controllerQuery.refetch();
  };

  const copySnapshot = async () => {
    if (!snapshot || !navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            captured_at: snapshot.iso_time,
            time_window: timeWindow.key,
            status: snapshot.status,
            derived: snapshot.derived,
            alerts,
          },
          null,
          2,
        ),
      );
      return true;
    } catch {
      return false;
    }
  };

  return {
    snapshot,
    history: sampledHistory,
    filteredCards,
    trendSeries,
    alerts,
    alertTransitions,
    filters,
    timeWindow,
    timeWindowOptions: TIME_WINDOW_OPTIONS,
    autoRefreshEnabled,
    query: {
      isLoading: controllerQuery.isLoading,
      isFetching: controllerQuery.isFetching,
      isError: controllerQuery.isError,
      error: controllerQuery.error,
      dataUpdatedAt: controllerQuery.dataUpdatedAt,
    },
    actions: {
      setTimeWindow: (next) => {
        if (TIME_WINDOW_OPTIONS.some((item) => item.key === next)) {
          setTimeWindowKey(next);
        }
      },
      setFilters: (patch) => {
        setFilters((previous) => ({ ...previous, ...patch }));
      },
      resetFilters: () => {
        setFilters({ ...DEFAULT_FILTERS });
      },
      setAutoRefresh: (enabled) => {
        setAutoRefreshEnabled(enabled);
      },
      toggleAutoRefresh: () => {
        setAutoRefreshEnabled((previous) => !previous);
      },
      refresh,
      copySnapshot,
    },
  };
}
