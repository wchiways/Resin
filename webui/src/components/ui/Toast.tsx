import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ToastItem } from "../../hooks/useToast";
import { useI18n } from "../../i18n";
import { cn } from "../../lib/cn";

const toastContainerVariants = cva("toast-container");

const toastItemVariants = cva("toast-item", {
    variants: {
        tone: {
            success: "toast-success",
            error: "toast-error",
        },
        exiting: {
            true: "toast-exit",
            false: "",
        },
    },
    defaultVariants: {
        exiting: false,
    },
});

const toastTextVariants = cva("toast-text");
const toastCloseVariants = cva("toast-close");

interface ToastContainerProps {
    toasts: ToastItem[];
    onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    const { t } = useI18n();

    if (toasts.length === 0) {
        return null;
    }

    return createPortal(
        <div className={toastContainerVariants()} aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} className={cn(toastItemVariants({ tone: toast.tone, exiting: toast.exiting }))}>
                    <span className={toastTextVariants()}>{t(toast.text)}</span>
                    <button
                        type="button"
                        className={toastCloseVariants()}
                        aria-label={t("关闭")}
                        onClick={() => onDismiss(toast.id)}
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>,
        document.body,
    );
}
