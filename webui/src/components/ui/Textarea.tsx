import { cva } from "class-variance-authority";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const textareaVariants = cva("textarea", {
  variants: {
    invalid: {
      true: "input-invalid",
      false: "",
    },
  },
  defaultVariants: {
    invalid: false,
  },
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return <textarea className={cn(textareaVariants({ invalid }), className)} {...props} />;
}
