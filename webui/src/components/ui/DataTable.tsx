import { cva } from "class-variance-authority";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { KeyboardEvent } from "react";
import { cn } from "../../lib/cn";

const dataTableWrapVariants = cva("data-table-wrap");
const dataTableVariants = cva("data-table");

function isKeyboardRowActivation(event: KeyboardEvent<HTMLTableRowElement>): boolean {
    return event.key === "Enter" || event.key === " ";
}

type DataTableProps<T> = {
    data: T[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<T, any>[];
    onRowClick?: (row: T) => void;
    selectedRowId?: string;
    getRowId?: (row: T) => string;
    className?: string;
    wrapClassName?: string;
};

export function DataTable<T>({
    data,
    columns,
    onRowClick,
    selectedRowId,
    getRowId,
    className,
    wrapClassName,
}: DataTableProps<T>) {
    // TanStack Table returns mutable table helpers; React Compiler intentionally skips memoizing here.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId,
    });

    return (
        <div className={cn(dataTableWrapVariants(), wrapClassName)}>
            <table className={cn(dataTableVariants(), className)}>
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th key={header.id}>
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => {
                        const isSelected = selectedRowId != null && row.id === selectedRowId;
                        const isClickable = onRowClick != null;
                        return (
                            <tr
                                key={row.id}
                                className={cn(
                                    isClickable && "data-table-row-clickable",
                                    isSelected && "data-table-row-selected",
                                )}
                                onClick={isClickable ? () => onRowClick(row.original) : undefined}
                                tabIndex={isClickable ? 0 : undefined}
                                onKeyDown={isClickable ? (event) => {
                                    if (event.target !== event.currentTarget) {
                                        return;
                                    }
                                    if (!isKeyboardRowActivation(event)) {
                                        return;
                                    }
                                    event.preventDefault();
                                    onRowClick(row.original);
                                } : undefined}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
