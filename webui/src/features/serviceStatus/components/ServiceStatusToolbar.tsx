import { RefreshCw, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Switch } from "../../../components/ui/Switch";
import { useI18n } from "../../../i18n";
import type { ServiceStatusCardCategory, ServiceStatusCardHealth, ServiceStatusFilters, ServiceStatusTimeWindowOption } from "../types";

type ServiceStatusToolbarProps = {
  title: string;
  description: string;
  timeWindow: ServiceStatusTimeWindowOption;
  timeWindowOptions: ServiceStatusTimeWindowOption[];
  filters: ServiceStatusFilters;
  autoRefreshEnabled: boolean;
  isFetching: boolean;
  onTimeWindowChange: (next: ServiceStatusTimeWindowOption["key"]) => void;
  onFiltersChange: (patch: Partial<ServiceStatusFilters>) => void;
  onAutoRefreshChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onResetFilters: () => void;
};

function timeWindowLabel(option: ServiceStatusTimeWindowOption, t: (text: string, options?: Record<string, unknown>) => string): string {
  if (option.key === "5m") {
    return t("最近 5 分钟");
  }
  if (option.key === "15m") {
    return t("最近 15 分钟");
  }
  if (option.key === "1h") {
    return t("最近 1 小时");
  }
  return t("最近 6 小时");
}

export function ServiceStatusToolbar({
  title,
  description,
  timeWindow,
  timeWindowOptions,
  filters,
  autoRefreshEnabled,
  isFetching,
  onTimeWindowChange,
  onFiltersChange,
  onAutoRefreshChange,
  onRefresh,
  onResetFilters,
}: ServiceStatusToolbarProps) {
  const { t } = useI18n();

  const categoryOptions: Array<{ value: ServiceStatusCardCategory | "all"; label: string }> = [
    { value: "all", label: t("全部分类") },
    { value: "proxy", label: t("代理") },
    { value: "system", label: t("系统") },
    { value: "runtime", label: t("运行时") },
  ];

  const healthOptions: Array<{ value: ServiceStatusCardHealth | "all"; label: string }> = [
    { value: "all", label: t("全部状态") },
    { value: "healthy", label: t("健康") },
    { value: "degraded", label: t("异常") },
    { value: "disabled", label: t("已禁用") },
  ];

  const alertLevelOptions: Array<{ value: ServiceStatusFilters["alert_level"]; label: string }> = [
    { value: "all", label: t("全部告警") },
    { value: "critical", label: t("严重") },
    { value: "warning", label: t("警告") },
    { value: "info", label: t("信息") },
  ];

  return (
    <header className="module-header">
        <div>
          <h2>{title}</h2>
          <p className="module-description">{description}</p>
        </div>
        <div className="inline-filters inline-filters-sm max-resin-lg:w-full max-resin-lg:justify-start">
          <label className="inline-filter-item-sm flex min-w-[132px] flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{t("时间窗")}</span>
            <Select
              uiSize="sm"
              value={timeWindow.key}
              onChange={(event) => onTimeWindowChange(event.target.value as ServiceStatusTimeWindowOption["key"])}
            >
              {timeWindowOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {timeWindowLabel(item, t)}
                </option>
              ))}
            </Select>
          </label>

          <label className="inline-filter-item-sm flex min-w-[132px] flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{t("分类")}</span>
            <Select
              uiSize="sm"
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value as ServiceStatusFilters["category"] })}
            >
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="inline-filter-item-sm flex min-w-[132px] flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{t("健康状态")}</span>
            <Select
              uiSize="sm"
              value={filters.health}
              onChange={(event) => onFiltersChange({ health: event.target.value as ServiceStatusFilters["health"] })}
            >
              {healthOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="inline-filter-item-sm flex min-w-[132px] flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{t("告警等级")}</span>
            <Select
              uiSize="sm"
              value={filters.alert_level}
              onChange={(event) =>
                onFiltersChange({ alert_level: event.target.value as ServiceStatusFilters["alert_level"] })
              }
            >
              {alertLevelOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="inline-filter-item-sm flex min-w-[172px] flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{t("检索")}</span>
            <span className="search-box m-0 w-full" style={{ margin: 0 }}>
              <Search size={14} />
              <Input
                uiSize="sm"
                value={filters.keyword}
                placeholder={t("标题/状态/指标")}
                onChange={(event) => onFiltersChange({ keyword: event.target.value })}
              />
            </span>
          </label>

          <label className="inline-filter-item-sm flex min-w-[132px] items-center gap-2 self-end pb-1 text-xs text-muted-foreground">
            <Switch
              checked={autoRefreshEnabled}
              onChange={(event) => onAutoRefreshChange(event.target.checked)}
              aria-label={t("自动刷新")}
            />
            <span>{t("自动刷新")}</span>
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-filter-action-btn self-end"
          >
            <RefreshCw size={14} className={isFetching ? "spin" : undefined} />
            {t("手动刷新")}
          </Button>

          <Button variant="ghost" size="sm" onClick={onResetFilters} className="inline-filter-action-btn self-end">
            {t("重置筛选")}
          </Button>
        </div>
      </header>
  );
}
