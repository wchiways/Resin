import type {
  ServiceStatusAlert,
  ServiceStatusAlertCode,
  ServiceStatusAlertLevel,
  ServiceStatusAlertTransition,
  ServiceStatusSnapshot,
} from "./types";

export interface ServiceStatusAlertRule {
  code: ServiceStatusAlertCode;
  level: ServiceStatusAlertLevel;
  message_key: string;
  isTriggered: (snapshot: ServiceStatusSnapshot) => boolean;
  value?: (snapshot: ServiceStatusSnapshot) => number;
  threshold?: number;
}

export interface ServiceStatusAlertEvaluation {
  alerts: ServiceStatusAlert[];
  transitions: ServiceStatusAlertTransition[];
}

const WARNING_QUEUE_USAGE = 0.8;
const WARNING_DROP_RATE = 1;
const CRITICAL_DROP_RATE = 10;
const WARNING_HEAP_USAGE = 0.85;
const CRITICAL_HEAP_USAGE = 0.95;

const ALERT_ORDER: ServiceStatusAlertCode[] = [
  "proxy_unhealthy",
  "queue_degraded",
  "queue_usage_high",
  "drop_rate_high",
  "memory_pressure_high",
  "flush_failure_increased",
];

function levelPriority(level: ServiceStatusAlertLevel): number {
  if (level === "critical") {
    return 3;
  }
  if (level === "warning") {
    return 2;
  }
  return 1;
}

function sortAlerts(alerts: ServiceStatusAlert[]): ServiceStatusAlert[] {
  return [...alerts].sort((left, right) => {
    const levelDiff = levelPriority(right.level) - levelPriority(left.level);
    if (levelDiff !== 0) {
      return levelDiff;
    }

    const leftOrder = ALERT_ORDER.indexOf(left.code);
    const rightOrder = ALERT_ORDER.indexOf(right.code);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.code.localeCompare(right.code);
  });
}

function buildAlert(
  snapshot: ServiceStatusSnapshot,
  rule: ServiceStatusAlertRule,
  state: "active" | "resolved",
  previous?: ServiceStatusAlert,
): ServiceStatusAlert {
  const now = snapshot.iso_time;
  return {
    code: rule.code,
    level: rule.level,
    state,
    message_key: rule.message_key,
    target_card_ids: targetCardsByCode(rule.code),
    triggered_at: previous?.triggered_at ?? now,
    updated_at: now,
    resolved_at: state === "resolved" ? now : undefined,
    value: rule.value ? rule.value(snapshot) : undefined,
    threshold: rule.threshold,
  };
}

function targetCardsByCode(code: ServiceStatusAlertCode): Array<"http_proxy" | "socks5_proxy" | "stability" | "version" | "resource"> {
  if (code === "proxy_unhealthy") {
    return ["http_proxy", "socks5_proxy", "stability"];
  }
  if (code === "memory_pressure_high") {
    return ["resource"];
  }
  if (code === "flush_failure_increased") {
    return ["stability", "resource"];
  }
  return ["stability"];
}

export function getServiceStatusAlertRules(): ServiceStatusAlertRule[] {
  return [
    {
      code: "proxy_unhealthy",
      level: "critical",
      message_key: "告警：代理健康状态异常",
      isTriggered: (snapshot) => !snapshot.status.stability.proxy_healthy,
    },
    {
      code: "queue_degraded",
      level: "warning",
      message_key: "告警：队列进入降级状态",
      isTriggered: (snapshot) => snapshot.status.stability.queue_degraded,
    },
    {
      code: "queue_usage_high",
      level: "warning",
      message_key: "告警：队列使用率过高",
      threshold: WARNING_QUEUE_USAGE,
      isTriggered: (snapshot) => snapshot.derived.queue_usage_rate >= WARNING_QUEUE_USAGE,
      value: (snapshot) => snapshot.derived.queue_usage_rate,
    },
    {
      code: "drop_rate_high",
      level: "critical",
      message_key: "告警：丢弃率过高",
      threshold: CRITICAL_DROP_RATE,
      isTriggered: (snapshot) => snapshot.derived.dropped_rate >= CRITICAL_DROP_RATE,
      value: (snapshot) => snapshot.derived.dropped_rate,
    },
    {
      code: "drop_rate_high",
      level: "warning",
      message_key: "告警：丢弃率升高",
      threshold: WARNING_DROP_RATE,
      isTriggered: (snapshot) => snapshot.derived.dropped_rate >= WARNING_DROP_RATE,
      value: (snapshot) => snapshot.derived.dropped_rate,
    },
    {
      code: "memory_pressure_high",
      level: "critical",
      message_key: "告警：内存压力过高",
      threshold: CRITICAL_HEAP_USAGE,
      isTriggered: (snapshot) => snapshot.derived.heap_usage_rate >= CRITICAL_HEAP_USAGE,
      value: (snapshot) => snapshot.derived.heap_usage_rate,
    },
    {
      code: "memory_pressure_high",
      level: "warning",
      message_key: "告警：内存压力升高",
      threshold: WARNING_HEAP_USAGE,
      isTriggered: (snapshot) => snapshot.derived.heap_usage_rate >= WARNING_HEAP_USAGE,
      value: (snapshot) => snapshot.derived.heap_usage_rate,
    },
    {
      code: "flush_failure_increased",
      level: "warning",
      message_key: "告警：队列刷新失败增长",
      isTriggered: (snapshot) => snapshot.derived.flush_failed_delta > 0,
      value: (snapshot) => snapshot.derived.flush_failed_delta,
    },
  ];
}

export function evaluateServiceStatusAlerts(
  snapshot: ServiceStatusSnapshot,
  previousAlerts: ServiceStatusAlert[] = [],
  rules = getServiceStatusAlertRules(),
): ServiceStatusAlertEvaluation {
  const previousByCode = new Map(previousAlerts.map((item) => [item.code, item]));

  const grouped = new Map<ServiceStatusAlertCode, ServiceStatusAlertRule[]>();
  for (const rule of rules) {
    const list = grouped.get(rule.code) ?? [];
    list.push(rule);
    grouped.set(rule.code, list);
  }

  const nextAlerts: ServiceStatusAlert[] = [];
  const transitions: ServiceStatusAlertTransition[] = [];

  for (const [code, codeRules] of grouped.entries()) {
    const matched = codeRules
      .filter((rule) => rule.isTriggered(snapshot))
      .sort((left, right) => levelPriority(right.level) - levelPriority(left.level))[0];

    const previous = previousByCode.get(code);

    if (matched) {
      const next = buildAlert(snapshot, matched, "active", previous);
      nextAlerts.push(next);

      if (!previous || previous.state === "resolved") {
        transitions.push({
          code,
          type: "raised",
          at: snapshot.iso_time,
          next_level: next.level,
        });
      } else if (previous.level !== next.level) {
        transitions.push({
          code,
          type: levelPriority(next.level) > levelPriority(previous.level) ? "escalated" : "deescalated",
          at: snapshot.iso_time,
          previous_level: previous.level,
          next_level: next.level,
        });
      } else {
        transitions.push({
          code,
          type: "continued",
          at: snapshot.iso_time,
          next_level: next.level,
        });
      }

      continue;
    }

    if (!previous || previous.state === "resolved") {
      continue;
    }

    const resolved: ServiceStatusAlert = {
      ...previous,
      state: "resolved",
      updated_at: snapshot.iso_time,
      resolved_at: snapshot.iso_time,
    };
    transitions.push({
      code,
      type: "resolved",
      at: snapshot.iso_time,
      previous_level: previous.level,
    });
    void resolved;
  }

  return {
    alerts: sortAlerts(nextAlerts),
    transitions,
  };
}
