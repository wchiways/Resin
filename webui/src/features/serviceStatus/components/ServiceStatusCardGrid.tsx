import { Activity, Cpu, Globe, Info, Wifi, WifiOff } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useI18n } from "../../../i18n";
import { formatBytes } from "../../../lib/bytes";
import { formatDateTime } from "../../../lib/time";
import type { ServiceStatusAlert, ServiceStatusCardModel, ServiceStatusSnapshot } from "../types";

type ServiceStatusCardGridProps = {
  snapshot: ServiceStatusSnapshot | undefined;
  cards: ServiceStatusCardModel[];
  alerts: ServiceStatusAlert[];
  onlyAlerting: boolean;
  onOnlyAlertingChange: (enabled: boolean) => void;
};

function cardTitle(card: ServiceStatusCardModel): string {
  return card.title_key;
}

function statusBadgeVariant(health: ServiceStatusCardModel["health"]): "success" | "warning" | "muted" {
  if (health === "degraded") {
    return "warning";
  }
  if (health === "disabled") {
    return "muted";
  }
  return "success";
}

function statusLabel(card: ServiceStatusCardModel): string {
  return card.status_key;
}

function cardIcon(card: ServiceStatusCardModel) {
  if (card.id === "http_proxy") {
    return <Globe size={18} />;
  }
  if (card.id === "socks5_proxy") {
    return card.health === "healthy" ? <Wifi size={18} /> : <WifiOff size={18} />;
  }
  if (card.id === "stability") {
    return <Activity size={18} />;
  }
  if (card.id === "version") {
    return <Info size={18} />;
  }
  return <Cpu size={18} />;
}

function metricLabel(key: string, t: (text: string, options?: Record<string, unknown>) => string): string {
  if (key === "listen_address") return t("监听地址");
  if (key === "queue_state") return t("队列状态");
  if (key === "queue_usage_rate") return t("队列使用率");
  if (key === "dropped_rate") return t("丢弃率");
  if (key === "dropped_total") return t("丢弃总量");
  if (key === "version") return t("版本");
  if (key === "git_commit") return t("提交");
  if (key === "uptime_seconds") return t("运行秒数");
  if (key === "heap_alloc_bytes") return t("堆分配");
  if (key === "sys_bytes") return t("系统内存");
  if (key === "heap_usage_rate") return t("堆使用率");
  if (key === "num_gc") return t("GC 次数");
  if (key === "total_ingress_bytes") return t("累计入站");
  if (key === "total_egress_bytes") return t("累计出站");
  return key;
}

function formatMetricValue(
  key: string,
  value: number | string,
  unit: "count" | "bytes" | "percent" | "duration" | "address" | undefined,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (key === "uptime_seconds") {
    return `${Math.max(0, Math.floor(value))}s`;
  }

  if (unit === "bytes") {
    return formatBytes(value);
  }
  if (unit === "percent") {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "count") {
    return `${Math.round(value)}`;
  }
  return `${value}`;
}

function alertsForCard(cardId: ServiceStatusCardModel["id"], alerts: ServiceStatusAlert[]): ServiceStatusAlert[] {
  return alerts.filter((item) => item.target_card_ids.includes(cardId));
}

function isCardAnomalous(card: ServiceStatusCardModel, cardAlerts: ServiceStatusAlert[]): boolean {
  return card.health === "degraded" || cardAlerts.length > 0;
}

export function ServiceStatusCardGrid({
  snapshot,
  cards,
  alerts,
  onlyAlerting,
  onOnlyAlertingChange,
}: ServiceStatusCardGridProps) {
  const { t } = useI18n();
  const visibleCards = onlyAlerting
    ? cards.filter((card) => isCardAnomalous(card, alertsForCard(card.id, alerts)))
    : cards;

  return (
    <section className="flex flex-col gap-2.5" id="status-cards">
      <div className="list-card-header">
        <div>
          <h3>{t("服务卡片")}</h3>
          <p>
            {onlyAlerting
              ? t("仅异常：{{visible}} / {{total}}", { visible: visibleCards.length, total: cards.length })
              : t("共 {{count}} 张卡片", { count: cards.length })}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAlerting}
            onChange={(event) => onOnlyAlertingChange(event.target.checked)}
          />
          {t("仅异常")}
        </label>
      </div>

      {!visibleCards.length ? (
        <div className="empty-box">
          <Activity size={16} />
          <p>{onlyAlerting ? t("当前无异常卡片") : t("暂无服务卡片")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3.5 max-resin-lg:grid-cols-1">
        {visibleCards.map((card) => {
          const scopedAlerts = alertsForCard(card.id, alerts);

          return (
            <Card key={card.id} className="flex flex-col gap-3.5 p-[18px]" id={`card-${card.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-foreground">
                  {cardIcon(card)}
                  <h3 className="text-[15px] font-bold">{cardTitle(card)}</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant={statusBadgeVariant(card.health)}>{statusLabel(card)}</Badge>
                  {scopedAlerts.length > 0 ? <Badge variant="danger">{t("{{count}} 告警", { count: scopedAlerts.length })}</Badge> : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {card.metrics.map((metric) => (
                  <div key={`${card.id}-${metric.key}`} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-muted-foreground">{metricLabel(metric.key, t)}</span>
                    <span className="font-mono text-[13px] font-semibold text-foreground">
                      {formatMetricValue(metric.key, metric.value, metric.unit)}
                    </span>
                  </div>
                ))}

                {card.id === "version" ? (
                  <div className="text-[12px] text-muted-foreground">
                    {t("最近采样")}：{snapshot ? formatDateTime(snapshot.iso_time) : "-"}
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
