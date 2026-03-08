import { AlertTriangle } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useI18n } from "../../../i18n";
import type { ServiceStatusAlert } from "../types";

type ServiceStatusAlertPanelProps = {
  alerts: ServiceStatusAlert[];
};

function levelBadgeVariant(level: ServiceStatusAlert["level"]): "danger" | "warning" | "info" {
  if (level === "critical") {
    return "danger";
  }
  if (level === "warning") {
    return "warning";
  }
  return "info";
}

function levelLabel(level: ServiceStatusAlert["level"], t: (text: string, options?: Record<string, unknown>) => string): string {
  if (level === "critical") {
    return t("严重");
  }
  if (level === "warning") {
    return t("警告");
  }
  return t("信息");
}

function formatAlertValue(alert: ServiceStatusAlert): string | null {
  if (typeof alert.value !== "number") {
    return null;
  }

  if (typeof alert.threshold === "number") {
    if (alert.threshold <= 1) {
      return `${(alert.value * 100).toFixed(1)}% / ${(alert.threshold * 100).toFixed(1)}%`;
    }
    return `${alert.value.toFixed(2)} / ${alert.threshold.toFixed(2)}`;
  }

  if (Math.abs(alert.value) <= 1) {
    return `${(alert.value * 100).toFixed(1)}%`;
  }

  return `${alert.value.toFixed(2)}`;
}

export function ServiceStatusAlertPanel({ alerts }: ServiceStatusAlertPanelProps) {
  const { t } = useI18n();
  const criticalCount = alerts.filter((item) => item.level === "critical").length;
  const warningCount = alerts.filter((item) => item.level === "warning").length;

  return (
    <Card className="flex flex-col gap-3 p-[14px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-foreground">
          <AlertTriangle size={16} />
          <h3 className="text-base font-bold">{t("当前告警")}</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant={criticalCount > 0 ? "danger" : "muted"}>{t("严重")} {criticalCount}</Badge>
          <Badge variant={warningCount > 0 ? "warning" : "muted"}>{t("警告")} {warningCount}</Badge>
          <Badge variant={alerts.length > 0 ? "info" : "success"}>
            {alerts.length > 0 ? t("总计 {{count}}", { count: alerts.length }) : t("无告警")}
          </Badge>
        </div>
      </div>

      {!alerts.length ? (
        <div className="callout callout-success m-0">
          <span>{t("当前未检测到活动告警。")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.slice(0, 5).map((alert) => {
            const value = formatAlertValue(alert);

            return (
              <div
                key={`${alert.code}-${alert.updated_at}`}
                className="flex items-center justify-between gap-2 rounded-[11px] border border-[rgba(37,72,120,0.14)] bg-[rgba(255,255,255,0.82)] px-2.5 py-[9px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{t(alert.message_key)}</p>
                  <p className="text-[11px] text-muted-foreground">{t("代码：{{code}}", { code: alert.code })}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {value ? <Badge variant="neutral">{value}</Badge> : null}
                  <Badge variant={levelBadgeVariant(alert.level)}>{levelLabel(alert.level, t)}</Badge>
                </div>
              </div>
            );
          })}

          {alerts.length > 5 ? (
            <p className="text-right text-xs text-muted-foreground">
              {t("其余 {{count}} 条告警请使用筛选查看。", { count: alerts.length - 5 })}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
