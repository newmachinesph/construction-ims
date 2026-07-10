"use client";

import { Check, Info, X } from "lucide-react";
import { useToastStore, type ToastKind } from "@/lib/store/toast";

const ICON: Record<ToastKind, typeof Check> = {
  success: Check,
  error: X,
  info: Info,
};

/** Renders queued toasts, bottom-right. Mounted once in the root layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-xs flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2 rounded-[var(--radius-card)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-lg"
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${t.kind === "error" ? "text-alert" : "text-ink"}`} />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-muted transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
