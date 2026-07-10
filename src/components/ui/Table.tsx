import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "./cn";

/** Scroll container so wide tables never break the page's horizontal layout. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-card border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line-strong bg-surface-2 text-left">
      <tr>{children}</tr>
    </thead>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function Th({ numeric, className, children, ...rest }: ThProps) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-muted",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

/** Zebra + hover applied to body rows via the tbody selector. */
export function TBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="[&_tr:nth-child(even)]:bg-surface-2 [&_tr:hover]:bg-surface-3">{children}</tbody>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-t border-line transition-colors", className)}>{children}</tr>;
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  muted?: boolean;
}

export function Td({ numeric, muted, className, children, ...rest }: TdProps) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        numeric && "text-right tabular",
        muted && "text-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr className="border-t border-line">
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted">
        {children ?? "Nothing to show yet."}
      </td>
    </tr>
  );
}
