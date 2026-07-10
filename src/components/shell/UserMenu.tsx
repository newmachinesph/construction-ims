"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { DropdownMenu, DropdownDivider } from "@/components/ui/DropdownMenu";
import { logout } from "@/lib/auth/actions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Avatar dropdown in the top bar: identity header, quick links, and logout.
 * Logout is a `<form action={logout}>` submit so it works without client JS.
 */
export function UserMenu({
  fullName,
  roleLabel,
  email,
  canSettings,
}: {
  fullName: string;
  roleLabel: string;
  email: string;
  canSettings: boolean;
}) {
  return (
    <DropdownMenu
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-sm transition-colors hover:border-line hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink">
            {initials(fullName)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-ink">{fullName}</span>
            <span className="block text-xs text-muted">{roleLabel}</span>
          </span>
          <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <UserRound className="size-4 text-muted" />
              {fullName}
            </div>
            <div className="mt-0.5 truncate pl-6 text-xs text-muted">{email}</div>
            <div className="mt-0.5 pl-6 text-xs text-muted">{roleLabel}</div>
          </div>
          {canSettings ? (
            <>
              <DropdownDivider />
              <Link href="/settings" onClick={close} role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink">
                <Settings className="size-4" /> Company settings
              </Link>
            </>
          ) : null}
          <DropdownDivider />
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-alert transition-colors hover:bg-surface-2"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </>
      )}
    </DropdownMenu>
  );
}
