import { cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const cardVariants = cva("card");

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn(cardVariants(), className)} {...props} />;
}
