import { Copy, ExternalLink, Stethoscope } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useI18n } from "../../../i18n";

type ServiceStatusDiagnosticsPanelProps = {
  canCopy: boolean;
  copied: boolean;
  onCopySnapshot: () => void;
};

const QUICK_LINKS: Array<{ href: string; labelKey: string }> = [
  { href: "#status-alerts", labelKey: "跳转告警" },
  { href: "#status-trends", labelKey: "跳转趋势" },
  { href: "#status-cards", labelKey: "跳转卡片" },
];

export function ServiceStatusDiagnosticsPanel({ canCopy, copied, onCopySnapshot }: ServiceStatusDiagnosticsPanelProps) {
  const { t } = useI18n();

  return (
    <Card className="flex flex-col gap-3 p-[14px]" id="status-diagnostics">
      <div className="flex items-center gap-2 text-foreground">
        <Stethoscope size={16} />
        <h3 className="text-base font-bold">{t("诊断操作")}</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("可复制当前窗口的服务快照（状态、衍生指标、告警），便于排障与回溯。")}
      </p>

      <div>
        <Button variant="secondary" size="sm" onClick={onCopySnapshot} disabled={!canCopy}>
          <Copy size={14} />
          {copied ? t("已复制") : t("复制快照")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 max-resin-sm:grid-cols-1">
        {QUICK_LINKS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="inline-flex items-center justify-center gap-1.5 rounded-[11px] border border-[rgba(37,72,120,0.14)] bg-[rgba(255,255,255,0.82)] px-2.5 py-[9px] text-xs font-semibold text-[#173f74] transition hover:border-[rgba(20,112,255,0.34)] hover:bg-[rgba(239,246,255,0.92)]"
          >
            <ExternalLink size={13} />
            {t(item.labelKey)}
          </a>
        ))}
      </div>
    </Card>
  );
}
