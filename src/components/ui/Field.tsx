import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

const CONTROL =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-ink focus:outline-none " +
  "focus:ring-2 focus:ring-ink/15 disabled:cursor-not-allowed disabled:opacity-50";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + inline error, the standard vertical form row. */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
        {required ? <span className="ml-0.5 text-alert">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "h-auto min-h-20 py-2", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** Banner for a whole-form error message returned by the API. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-md border border-alert/40 bg-alert/5 px-3 py-2 text-sm text-alert" role="alert">
      {children}
    </div>
  );
}
