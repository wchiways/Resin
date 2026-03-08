import { AlertTriangle, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../../../components/ui/Card";
import { useI18n } from "../../../i18n";
import type { ServiceStatusTrendSeries } from "../types";

type ServiceStatusTrendPanelProps = {
  trendSeries: ServiceStatusTrendSeries[];
};

type TrendLineDefinition = {
  key: string;
  label: string;
  color: string;
  formatter: (value: number) => string;
};

type TrendPoint = {
  timestamp: number;
  label: string;
  [key: string]: number | string;
};

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
};

type TrendChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  lines: TrendLineDefinition[];
};

const CHART_STYLES = {
  traffic: {
    ingress: "#1076ff",
    egress: "#00a17f",
  },
  queue: {
    usage: "#2467e4",
    drop: "#f18f01",
  },
  memory: {
    heap: "#8b5cf6",
  },
};

function formatChartClock(timestamp: number, locale: string): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "--";
  }

  return new Intl.DateTimeFormat(locale === "en-US" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBytesPerSecond(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let next = value;
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next.toFixed(next >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function toPointMap(series: ServiceStatusTrendSeries[]): Map<ServiceStatusTrendSeries["metric"], ServiceStatusTrendSeries> {
  return new Map(series.map((item) => [item.metric, item]));
}

function mergeTrendPoints(
  source: ServiceStatusTrendSeries[],
  mappings: Array<{ metric: ServiceStatusTrendSeries["metric"]; dataKey: string }>,
  locale: string,
): TrendPoint[] {
  const byMetric = toPointMap(source);
  const primary = byMetric.get(mappings[0].metric);
  if (!primary?.points.length) {
    return [];
  }

  return primary.points.map((point, index) => {
    const next: TrendPoint = {
      timestamp: point.timestamp,
      label: formatChartClock(point.timestamp, locale),
    };

    for (const mapping of mappings) {
      const series = byMetric.get(mapping.metric);
      next[mapping.dataKey] = series?.points[index]?.value ?? 0;
    }

    return next;
  });
}

function TrendChartTooltip({ active, payload, label, lines }: TrendChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="trend-tooltip">
      <p className="trend-tooltip-time">{label ?? "--"}</p>
      <div className="trend-tooltip-list">
        {lines.map((line) => {
          const entry = payload.find((item) => item.dataKey === line.key);
          const value = Number(entry?.value ?? 0);

          return (
            <p key={line.key} className="trend-tooltip-row">
              <span>
                <i style={{ background: line.color }} />
                {line.label}
              </span>
              <b>{line.formatter(Number.isFinite(value) ? value : 0)}</b>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({
  title,
  subtitle,
  points,
  lines,
  emptyText,
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  lines: TrendLineDefinition[];
  emptyText: string;
}) {
  if (!points.length || !lines.length) {
    return (
      <Card className="flex flex-col gap-2.5 p-3">
        <div>
          <h4 className="m-0 text-sm font-bold">{title}</h4>
          <p className="mt-[3px] text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="empty-box dashboard-empty">
          <AlertTriangle size={14} />
          <p>{emptyText}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2.5 p-3">
      <div>
        <h4 className="m-0 text-sm font-bold">{title}</h4>
        <p className="mt-[3px] text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="trend-chart">
        <div className="trend-svg">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 6, right: 8, bottom: 4, left: 8 }}>
              <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
              <YAxis
                width="auto"
                tickMargin={4}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#657691", fontSize: 11, fontWeight: 600 }}
                domain={[0, "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "rgba(15, 94, 216, 0.34)", strokeWidth: 1 }}
                wrapperStyle={{ outline: "none" }}
                content={<TrendChartTooltip lines={lines} />}
              />

              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3, stroke: "#ffffff", strokeWidth: 1, fill: line.color }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="trend-footer">
          <span>{points[0]?.label ?? "--"}</span>
          <span>{points[points.length - 1]?.label ?? "--"}</span>
        </div>
      </div>
    </Card>
  );
}

export function ServiceStatusTrendPanel({ trendSeries }: ServiceStatusTrendPanelProps) {
  const { locale, t } = useI18n();

  const trafficPoints = mergeTrendPoints(trendSeries, [
    { metric: "ingress_bps", dataKey: "ingress" },
    { metric: "egress_bps", dataKey: "egress" },
  ], locale);

  const queuePoints = mergeTrendPoints(trendSeries, [
    { metric: "queue_usage_rate", dataKey: "queue_usage" },
    { metric: "dropped_rate", dataKey: "drop_rate" },
  ], locale);

  const memoryPoints = mergeTrendPoints(trendSeries, [{ metric: "heap_usage_rate", dataKey: "heap_usage" }], locale);

  return (
    <section className="grid grid-cols-3 gap-2.5 max-resin-lg:grid-cols-2 max-resin-sm:grid-cols-1">
      <TrendChart
        title={t("流量趋势")}
        subtitle={t("入站/出站吞吐速率")}
        points={trafficPoints}
        emptyText={t("暂无流量趋势数据")}
        lines={[
          { key: "ingress", label: t("入站"), color: CHART_STYLES.traffic.ingress, formatter: formatBytesPerSecond },
          { key: "egress", label: t("出站"), color: CHART_STYLES.traffic.egress, formatter: formatBytesPerSecond },
        ]}
      />

      <TrendChart
        title={t("队列趋势")}
        subtitle={t("队列使用率与丢弃率")}
        points={queuePoints}
        emptyText={t("暂无队列趋势数据")}
        lines={[
          { key: "queue_usage", label: t("队列使用率"), color: CHART_STYLES.queue.usage, formatter: formatPercent },
          { key: "drop_rate", label: t("丢弃率"), color: CHART_STYLES.queue.drop, formatter: formatPercent },
        ]}
      />

      <TrendChart
        title={t("内存趋势")}
        subtitle={t("堆内存使用率")}
        points={memoryPoints}
        emptyText={t("暂无内存趋势数据")}
        lines={[
          { key: "heap_usage", label: t("堆使用率"), color: CHART_STYLES.memory.heap, formatter: formatPercent },
        ]}
      />

      <div className="col-span-3 hidden items-center gap-2 rounded-[11px] border border-[rgba(37,72,120,0.14)] bg-[rgba(255,255,255,0.82)] px-2.5 py-[9px] text-xs text-muted-foreground max-resin-sm:col-span-1 max-resin-sm:flex">
        <TrendingUp size={14} />
        <span>{t("趋势图自动适配时间窗，支持无数据空态展示。")}</span>
      </div>
    </section>
  );
}
