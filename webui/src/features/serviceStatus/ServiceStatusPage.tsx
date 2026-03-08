import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, Globe, Info, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n";
import { isEnglishLocale } from "../../i18n/locale";
import { formatBytes } from "../../lib/bytes";
import { cn } from "../../lib/cn";
import { formatApiErrorMessage } from "../../lib/error-message";
import { formatDateTime } from "../../lib/time";
import { getSystemStatus } from "./api";

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

  const statusQuery = useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
    refetchInterval: 5_000,
  });

  const data = statusQuery.data;

  if (statusQuery.isError) {
    return (
      <section className="flex flex-col gap-3.5">
        <header className="module-header">
          <div>
            <h2>{t("服务状态")}</h2>
            <p className="module-description">{t("系统运行状态监控")}</p>
          </div>
        </header>
        <div className="callout callout-error">
          <span>{formatApiErrorMessage(statusQuery.error, t)}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3.5">
      <header className="module-header">
        <div>
          <h2>{t("服务状态")}</h2>
          <p className="module-description">{t("系统运行状态监控")}</p>
        </div>
      </header>

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-resin-lg:grid-cols-1">
        {/* HTTP Proxy */}
        <Card className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-foreground">
              <Globe size={18} />
              <h3 className="text-[15px] font-bold">HTTP {t("代理")}</h3>
            </div>
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                data?.http_proxy.enabled
                  ? "animate-[dot-pulse_2s_ease-in-out_infinite] bg-[var(--success)] shadow-[0_0_8px_rgba(4,136,103,0.45)]"
                  : "bg-[#b0bac8]",
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-bold text-foreground">{data?.http_proxy.enabled ? t("运行中") : t("已禁用")}</p>
            <p className="font-mono text-[13px] text-muted-foreground">{data?.http_proxy.listen_address || "-"}</p>
          </div>
        </Card>

        {/* SOCKS5 Proxy */}
        <Card className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-foreground">
              {data?.socks5_proxy.enabled ? <Wifi size={18} /> : <WifiOff size={18} />}
              <h3 className="text-[15px] font-bold">SOCKS5 {t("代理")}</h3>
            </div>
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                data?.socks5_proxy.enabled
                  ? "animate-[dot-pulse_2s_ease-in-out_infinite] bg-[var(--success)] shadow-[0_0_8px_rgba(4,136,103,0.45)]"
                  : "bg-[#b0bac8]",
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-bold text-foreground">{data?.socks5_proxy.enabled ? t("运行中") : t("未启用")}</p>
            <p className="font-mono text-[13px] text-muted-foreground">{data?.socks5_proxy.listen_address || "-"}</p>
          </div>
        </Card>

        {/* Stability */}
        <Card className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-foreground">
              <Activity size={18} />
              <h3 className="text-[15px] font-bold">{t("稳定性")}</h3>
            </div>
            <Badge variant={data?.stability.queue_degraded ? "warning" : "success"}>
              {data?.stability.queue_degraded ? t("降级") : t("稳定")}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("队列状态")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data
                  ? `${data.request_log_queue.queue_len}/${data.request_log_queue.queue_capacity}`
                  : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("丢弃率")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data ? `${data.stability.dropped_rate}%` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("失败提示")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data
                  ? `${data.stability.timeout_hint ? t("超时") : "-"} / ${data.stability.cancel_hint ? t("取消") : "-"}`
                  : "-"}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {data
                ? `${t("超时窗口")}: ${data.timeouts.proxy_transport_dial_timeout} · ${data.timeouts.proxy_transport_response_header_timeout}`
                : "-"}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {data
                ? `${t("请求读取窗口")}: ${data.timeouts.inbound_server_read_header_timeout} / ${data.timeouts.inbound_server_read_timeout}`
                : "-"}
            </div>
          </div>
        </Card>

        {/* Version Info */}
        <Card className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-foreground">
              <Info size={18} />
              <h3 className="text-[15px] font-bold">{t("版本信息")}</h3>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">Version</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data ? `${data.version} (${data.git_commit.slice(0, 7)})` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("运行时长")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data ? <LiveUptime baseSeconds={data.uptime_seconds} baselineMs={statusQuery.dataUpdatedAt} english={english} /> : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("构建时间")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">{data ? formatDateTime(data.build_time) : "-"}</span>
            </div>
          </div>
        </Card>

        {/* Resource Usage */}
        <Card className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-foreground">
              <Cpu size={18} />
              <h3 className="text-[15px] font-bold">{t("资源使用")}</h3>
            </div>
            <Activity size={16} className="animate-[dot-pulse_2s_ease-in-out_infinite] text-[var(--success)]" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("内存使用")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {data ? `${formatBytes(data.memory.heap_alloc_bytes)} / ${formatBytes(data.memory.sys_bytes)}` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("GC 次数")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">{data?.memory.num_gc ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("入站流量")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">{data ? formatBytes(data.traffic.total_ingress_bytes) : "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{t("出站流量")}</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">{data ? formatBytes(data.traffic.total_egress_bytes) : "-"}</span>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
