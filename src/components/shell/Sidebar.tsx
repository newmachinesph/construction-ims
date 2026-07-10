"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Package, X } from "lucide-react";
import type { Role } from "@/db/schema";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/components/ui/cn";
import { NAV } from "./nav";

/** True for the section root and any nested route under it. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => hasPermission(role, item.permission));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-paper" : "text-faint group-hover:text-ink")} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
      <span className="flex size-8 items-center justify-center rounded-md bg-ink text-paper">
        <Package className="size-4" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-ink">JuanBuild</div>
        <div className="text-[10px] uppercase tracking-widest text-muted">Inventory</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 inline-flex size-10 items-center justify-center rounded-md border border-line-strong bg-surface text-ink md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        {brand}
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-md bg-ink text-paper">
                  <Package className="size-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight text-ink">JuanBuild</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
