import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./Switch.css";

const switchWrapperVariants = cva("switch-wrapper");
const switchVariants = cva("switch");
const switchInputVariants = cva("switch-input");
const switchSliderVariants = cva("switch-slider");

type SwitchProps = Omit<ComponentProps<"input">, "type" | "className"> & {
  className?: string;
};

export function Switch({ className, ...props }: SwitchProps) {
    return (
        <span className={cn(switchWrapperVariants(), className)}>
            <label className={switchVariants()}>
                <input type="checkbox" className={cn(switchInputVariants())} {...props} />
                <span className={switchSliderVariants()}></span>
            </label>
        </span>
    );
}
