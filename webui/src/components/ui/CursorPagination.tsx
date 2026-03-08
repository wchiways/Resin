import { cva } from "class-variance-authority";
import { Button } from "./Button";
import { Select } from "./Select";
import { useI18n } from "../../i18n";
import { cn } from "../../lib/cn";

const nodesPaginationVariants = cva("nodes-pagination");
const nodesPaginationMetaVariants = cva("nodes-pagination-meta");
const nodesPaginationControlsVariants = cva("nodes-pagination-controls");
const nodesPageSizeVariants = cva("nodes-page-size");

type CursorPaginationProps = {
    pageIndex: number;
    hasMore: boolean;
    pageSize: number;
    pageSizeOptions?: readonly number[];
    disabled?: boolean;
    onPageSizeChange: (pageSize: number) => void;
    onPrev: () => void;
    onNext: () => void;
};

export function CursorPagination({
    pageIndex,
    hasMore,
    pageSize,
    pageSizeOptions = [20, 50, 100, 200],
    disabled = false,
    onPageSizeChange,
    onPrev,
    onNext,
}: CursorPaginationProps) {
    const { t } = useI18n();

    return (
        <div className={nodesPaginationVariants()}>
            <p className={nodesPaginationMetaVariants()}>
                {hasMore
                    ? t("第 {{page}} 页 · 有更多数据", { page: pageIndex + 1 })
                    : t("第 {{page}} 页 · 无更多数据", { page: pageIndex + 1 })}
            </p>
            <div className={nodesPaginationControlsVariants()}>
                <label className={nodesPageSizeVariants()}>
                    <span>{t("每页")}</span>
                    <Select value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))} disabled={disabled}>
                        {pageSizeOptions.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </Select>
                </label>

                <Button className={cn("h-9 px-2.5")} variant="secondary" size="sm" onClick={onPrev} disabled={disabled || pageIndex <= 0}>
                    {t("上一页")}
                </Button>
                <Button className={cn("h-9 px-2.5")} variant="secondary" size="sm" onClick={onNext} disabled={disabled || !hasMore}>
                    {t("下一页")}
                </Button>
            </div>
        </div>
    );
}
