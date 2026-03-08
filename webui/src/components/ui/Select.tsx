import { cva } from "class-variance-authority";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const selectVariants = cva("select", {
  variants: {
    invalid: {
      true: "input-invalid",
      false: "",
    },
    uiSize: {
      default: "",
      sm: "select-sm",
    },
  },
  defaultVariants: {
    invalid: false,
    uiSize: "default",
  },
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  uiSize?: "default" | "sm";
};

export function Select({ className, invalid = false, uiSize = "default", children, ...props }: SelectProps) {
  return (
    <select className={cn(selectVariants({ invalid, uiSize }), className)} {...props}>
      {children}
    </select>
  );
}
