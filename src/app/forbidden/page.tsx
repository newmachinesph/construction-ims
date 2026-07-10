import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-paper px-6 py-20">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-3 text-ink">
          <ShieldAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">403 — Forbidden</h1>
        <p className="mt-2 text-sm text-muted">
          Your role does not have permission to view this page. If you believe this is a mistake,
          contact your administrator.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
