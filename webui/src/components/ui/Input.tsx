import { cva } from "class-variance-authority";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const inputVariants = cva("input", {
  variants: {
    invalid: {
      true: "input-invalid",
      false: "",
    },
    uiSize: {
      default: "",
      sm: "input-sm",
    },
  },
  defaultVariants: {
    invalid: false,
    uiSize: "default",
  },
});

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  uiSize?: "default" | "sm";
};

export function Input({ className, invalid = false, uiSize = "default", ...props }: InputProps) {
  return <input className={cn(inputVariants({ invalid, uiSize }), className)} {...props} />;
}
