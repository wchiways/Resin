import { cn } from "./cn";

export type KpiIconKind = "lease" | "shield" | "gauge" | "waves";

const KPI_ICON_BASE_CLASS = "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[11px] border";

const KPI_ICON_VARIANT_CLASS: Record<KpiIconKind, string> = {
  lease: "text-[#5d46da] border-[rgba(93,70,218,0.24)] bg-[rgba(108,78,246,0.12)]",
  shield: "text-[#007f55] border-[rgba(0,127,85,0.24)] bg-[rgba(12,159,104,0.12)]",
  gauge: "text-[#a86500] border-[rgba(168,101,0,0.22)] bg-[rgba(241,143,1,0.12)]",
  waves: "text-[#0f73ea] border-[rgba(15,115,234,0.22)] bg-[rgba(15,115,234,0.12)]",
};

export function kpiIconClass(kind: KpiIconKind): string {
  return cn(KPI_ICON_BASE_CLASS, KPI_ICON_VARIANT_CLASS[kind]);
}
