import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, Globe, Info, Wifi, WifiOff } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n";
import { isEnglishLocale } from "../../i18n/locale";
import { formatApiErrorMessage } from "../../lib/error-message";
import { formatBytes } from "../../lib/bytes";
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
      <section className="service-status-page">
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
    <section className="service-status-page">
      <header className="module-header">
        <div>
          <h2>{t("服务状态")}</h2>
          <p className="module-description">{t("系统运行状态监控")}</p>
        </div>
      </header>

      <div className="service-status-grid">
        {/* HTTP Proxy */}
        <Card className="service-status-card">
          <div className="service-status-card-header">
            <div className="service-status-icon-group">
              <Globe size={18} />
              <h3>HTTP {t("代理")}</h3>
            </div>
            <span className={`service-status-dot ${data?.http_proxy.enabled ? "dot-online" : "dot-offline"}`} />
          </div>
          <div className="service-status-card-body">
            <p className="service-status-value">
              {data?.http_proxy.enabled ? t("运行中") : t("已禁用")}
            </p>
            <p className="service-status-detail">{data?.http_proxy.listen_address || "-"}</p>
          </div>
        </Card>

        {/* SOCKS5 Proxy */}
        <Card className="service-status-card">
          <div className="service-status-card-header">
            <div className="service-status-icon-group">
              {data?.socks5_proxy.enabled ? <Wifi size={18} /> : <WifiOff size={18} />}
              <h3>SOCKS5 {t("代理")}</h3>
            </div>
            <span className={`service-status-dot ${data?.socks5_proxy.enabled ? "dot-online" : "dot-offline"}`} />
          </div>
          <div className="service-status-card-body">
            <p className="service-status-value">
              {data?.socks5_proxy.enabled ? t("运行中") : t("未启用")}
            </p>
            <p className="service-status-detail">{data?.socks5_proxy.listen_address || "-"}</p>
          </div>
        </Card>

        {/* Version Info */}
        <Card className="service-status-card">
          <div className="service-status-card-header">
            <div className="service-status-icon-group">
              <Info size={18} />
              <h3>{t("版本信息")}</h3>
            </div>
          </div>
          <div className="service-status-card-body">
            <div className="service-status-kv">
              <span className="service-status-label">Version</span>
              <span className="service-status-mono">
                {data ? `${data.version} (${data.git_commit.slice(0, 7)})` : "-"}
              </span>
            </div>
            <div className="service-status-kv">
              <span className="service-status-label">{t("运行时长")}</span>
              <span className="service-status-mono">
                {data ? formatUptime(data.uptime_seconds, english) : "-"}
              </span>
            </div>
            <div className="service-status-kv">
              <span className="service-status-label">{t("构建时间")}</span>
              <span className="service-status-mono">
                {data ? formatDateTime(data.build_time) : "-"}
              </span>
            </div>
          </div>
        </Card>

        {/* Resource Usage */}
        <Card className="service-status-card">
          <div className="service-status-card-header">
            <div className="service-status-icon-group">
              <Cpu size={18} />
              <h3>{t("资源使用")}</h3>
            </div>
            <Activity size={16} className="service-status-pulse" />
          </div>
          <div className="service-status-card-body">
            <div className="service-status-kv">
              <span className="service-status-label">{t("内存使用")}</span>
              <span className="service-status-mono">
                {data ? `${formatBytes(data.memory.heap_alloc_bytes)} / ${formatBytes(data.memory.sys_bytes)}` : "-"}
              </span>
            </div>
            <div className="service-status-kv">
              <span className="service-status-label">{t("GC 次数")}</span>
              <span className="service-status-mono">{data?.memory.num_gc ?? "-"}</span>
            </div>
            <div className="service-status-kv">
              <span className="service-status-label">{t("入站流量")}</span>
              <span className="service-status-mono">
                {data ? formatBytes(data.traffic.total_ingress_bytes) : "-"}
              </span>
            </div>
            <div className="service-status-kv">
              <span className="service-status-label">{t("出站流量")}</span>
              <span className="service-status-mono">
                {data ? formatBytes(data.traffic.total_egress_bytes) : "-"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
