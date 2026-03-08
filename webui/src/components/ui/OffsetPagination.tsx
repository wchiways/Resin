import { cva } from "class-variance-authority";
import { useMemo } from "react";
import { Button } from "./Button";
import { Select } from "./Select";
import { useI18n } from "../../i18n";
import { cn } from "../../lib/cn";

const nodesPaginationVariants = cva("nodes-pagination");
const nodesPaginationMetaVariants = cva("nodes-pagination-meta");
const nodesPaginationControlsVariants = cva("nodes-pagination-controls");
const nodesPageSizeVariants = cva("nodes-page-size");
const nodesPageJumpVariants = cva("nodes-page-jump");

type OffsetPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function OffsetPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: OffsetPaginationProps) {
  const { t } = useI18n();
  const normalizedTotalPages = Math.max(1, totalPages);
  const normalizedPage = Math.min(Math.max(page, 0), normalizedTotalPages - 1);
  const pageStart = totalItems === 0 ? 0 : normalizedPage * pageSize + 1;
  const pageEnd = Math.min((normalizedPage + 1) * pageSize, totalItems);

  const pageOptions = useMemo(() => {
    return Array.from({ length: normalizedTotalPages }, (_, index) => index);
  }, [normalizedTotalPages]);

  const jumpTo = (nextPage: number) => {
    const bounded = Math.min(Math.max(nextPage, 0), normalizedTotalPages - 1);
    onPageChange(bounded);
  };

  return (
    <div className={nodesPaginationVariants()}>
      <p className={nodesPaginationMetaVariants()}>
        {t("第 {{page}} / {{pages}} 页 · 显示 {{start}}-{{end}} / {{total}}", {
          page: normalizedPage + 1,
          pages: normalizedTotalPages,
          start: pageStart,
          end: pageEnd,
          total: totalItems,
        })}
      </p>
      <div className={nodesPaginationControlsVariants()}>
        <label className={nodesPageSizeVariants()}>
          <span>{t("每页")}</span>
          <Select value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>

        <label className={nodesPageJumpVariants()}>
          <span>{t("跳至")}</span>
          <Select
            value={String(normalizedPage)}
            onChange={(event) => jumpTo(Number(event.target.value))}
            aria-label={t("选择页码")}
          >
            {pageOptions.map((index) => (
              <option key={index} value={index}>
                {index + 1}
              </option>
            ))}
          </Select>
          <span>{t("页")}</span>
        </label>

        <Button className={cn("h-9 px-2.5")} variant="secondary" size="sm" onClick={() => jumpTo(normalizedPage - 1)} disabled={normalizedPage <= 0}>
          {t("上一页")}
        </Button>
        <Button
          className={cn("h-9 px-2.5")}
          variant="secondary"
          size="sm"
          onClick={() => jumpTo(normalizedPage + 1)}
          disabled={normalizedPage >= normalizedTotalPages - 1}
        >
          {t("下一页")}
        </Button>
      </div>
    </div>
  );
}
