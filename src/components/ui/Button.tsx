import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft active:bg-ink",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-alert text-alert hover:bg-alert/10 active:bg-alert/15",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button({ variant = "primary", size = "md", className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    />
  );
}
