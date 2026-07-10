import type { ReactNode } from "react";
import { cn } from "./cn";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  alert?: boolean;
}

export function StatTile({ label, value, hint, icon, alert }: StatTileProps) {
  return (
    <div className="flex flex-col justify-between rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
        {icon ? <span className="text-faint">{icon}</span> : null}
      </div>
      <div className={cn("mt-4 tabular text-3xl font-semibold leading-none", alert ? "text-alert" : "text-ink")}>
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
