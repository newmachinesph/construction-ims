import {
  cloneElement,
  isValidElement,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactElement,
  type ReactNode,
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
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const describedBy = errorId ?? hintId;

  // Link the hint/error to the control so a screen reader announces them, and
  // flag the control invalid — Field always wraps exactly one input.
  const control =
    isValidElement(children) && (describedBy || error)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>, {
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
        {required ? <span className="ml-0.5 text-alert">*</span> : null}
      </label>
      {control}
      {hint && !error ? <p id={hintId} className="text-xs text-muted">{hint}</p> : null}
      {error ? <p id={errorId} className="text-xs text-alert">{error}</p> : null}
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
