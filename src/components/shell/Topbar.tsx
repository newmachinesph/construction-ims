import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";

/** Initials for the avatar chip, e.g. "Ramon Dela Cruz" -> "RD". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-4 border-b border-line bg-surface/90 px-4 pl-16 backdrop-blur md:px-6 md:pl-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink">
          {initials(user.fullName)}
        </span>
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-medium text-ink">{user.fullName}</div>
          <div className="text-xs text-muted">{ROLE_LABELS[user.role]}</div>
        </div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </form>
    </header>
  );
}
