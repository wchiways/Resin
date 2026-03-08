import { AlertTriangle, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n";
import { isEnglishLocale } from "../../i18n/locale";
import { formatApiErrorMessage } from "../../lib/error-message";
import { formatDateTime } from "../../lib/time";
import { ServiceStatusAlertPanel } from "./components/ServiceStatusAlertPanel";
import { ServiceStatusCardGrid } from "./components/ServiceStatusCardGrid";
import { ServiceStatusDiagnosticsPanel } from "./components/ServiceStatusDiagnosticsPanel";
import { ServiceStatusToolbar } from "./components/ServiceStatusToolbar";
import { ServiceStatusTrendPanel } from "./components/ServiceStatusTrendPanel";
import { useServiceStatusController } from "./useServiceStatusController";

function formatUptime(seconds: number, english: boolean): string {
  if (seconds <= 0) return english ? "0s" : "0 秒";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (english) {
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
    if (days === 0 && hours === 0 && secs > 0) parts.push(`${secs}s`);
    return parts.slice(0, 2).join(" ");
  }
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小时`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} 分钟`);
  if (days === 0 && hours === 0 && secs > 0) parts.push(`${secs} 秒`);
  return parts.slice(0, 2).join("");
}

function LiveUptime({
  baseSeconds,
  baselineMs,
  english,
}: {
  baseSeconds: number;
  baselineMs: number;
  english: boolean;
}) {
  const [tickMs, setTickMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const uptimeSeconds = baseSeconds + Math.max(0, Math.floor((tickMs - baselineMs) / 1_000));
  return <>{formatUptime(uptimeSeconds, english)}</>;
}

export function ServiceStatusPage() {
  const { t, locale } = useI18n();
  const english = isEnglishLocale(locale);
  const controller = useServiceStatusController();
  const [copied, setCopied] = useState(false);

  const snapshot = controller.snapshot;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const handleCopySnapshot = () => {
    void (async () => {
      const ok = await controller.actions.copySnapshot();
      setCopied(ok);
    })();
  };

  if (controller.query.isError && !snapshot) {
    return (
      <section className="flex flex-col gap-3.5">
        <header className="module-header">
          <div>
            <h2>{t("服务状态")}</h2>
            <p className="module-description">{t("系统运行状态监控")}</p>
          </div>
        </header>

        <div className="callout callout-error">
          <AlertTriangle size={14} />
          <span>{formatApiErrorMessage(controller.query.error, t)}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3.5">
      <ServiceStatusToolbar
        title={t("服务状态")}
        description={t("系统运行状态监控")}
        timeWindow={controller.timeWindow}
        timeWindowOptions={controller.timeWindowOptions}
        filters={controller.filters}
        autoRefreshEnabled={controller.autoRefreshEnabled}
        isFetching={controller.query.isFetching}
        onTimeWindowChange={controller.actions.setTimeWindow}
        onFiltersChange={controller.actions.setFilters}
        onAutoRefreshChange={controller.actions.setAutoRefresh}
        onRefresh={() => {
          void controller.actions.refresh();
        }}
        onResetFilters={controller.actions.resetFilters}
      />

      {controller.query.isError ? (
        <div className="callout callout-error">
          <AlertTriangle size={14} />
          <span>{formatApiErrorMessage(controller.query.error, t)}</span>
        </div>
      ) : null}

      <div className="grid service-status-layout grid-cols-[minmax(0,1fr)_320px] gap-3.5 max-resin-xl:grid-cols-1">
        <section id="status-alerts">
          <ServiceStatusAlertPanel alerts={controller.alerts} />
        </section>

        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-col gap-3 p-[14px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-foreground">
                <Activity size={16} />
                <h3 className="text-base font-bold">{t("运行摘要")}</h3>
              </div>

              {controller.query.isFetching ? <Badge variant="warning">{t("刷新中...")}</Badge> : <Badge variant="success">{t("最新")}</Badge>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{t("版本")}</span>
                <span className="font-mono text-[13px] font-semibold text-foreground">
                  {snapshot ? `${snapshot.status.version} (${snapshot.status.git_commit.slice(0, 7)})` : "-"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{t("运行时长")}</span>
                <span className="font-mono text-[13px] font-semibold text-foreground">
                  {snapshot ? (
                    <LiveUptime
                      baseSeconds={snapshot.status.uptime_seconds}
                      baselineMs={controller.query.dataUpdatedAt || snapshot.timestamp}
                      english={english}
                    />
                  ) : (
                    "-"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{t("最近采样")}</span>
                <span className="font-mono text-[13px] font-semibold text-foreground">
                  {snapshot ? formatDateTime(snapshot.iso_time) : "-"}
                </span>
              </div>
            </div>
          </Card>

          <ServiceStatusDiagnosticsPanel canCopy={Boolean(snapshot)} copied={copied} onCopySnapshot={handleCopySnapshot} />
        </div>
      </div>

      <section id="status-trends">
        <ServiceStatusTrendPanel trendSeries={controller.trendSeries} />
      </section>

      <ServiceStatusCardGrid
        snapshot={snapshot}
        cards={controller.filteredCards}
        alerts={controller.alerts}
        onlyAlerting={controller.filters.only_alerting}
        onOnlyAlertingChange={(enabled) => controller.actions.setFilters({ only_alerting: enabled })}
      />

      {controller.query.isLoading && !snapshot ? (
        <div className="callout callout-warning">
          <Activity size={14} />
          <span>{t("服务状态数据加载中...")}</span>
        </div>
      ) : null}
    </section>
  );
}
