import { requireUserPage } from "@/lib/auth/dal";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();

  // The shell must NOT carry `flex-1`. As a flex item of <body> (a column flex
  // container), flex-1 sets flex-basis:0%, which overrides h-dvh when computing the
  // flex base size — the shell then grows to its content instead of the viewport,
  // overflow-hidden clips nothing, and the whole document scrolls, taking the
  // sidebar with it. h-dvh alone pins it to the viewport so <main> is the only
  // scroll container.
  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to main content
      </a>
      <Sidebar permissions={user.permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main id="main" className="flex-1 overflow-y-auto [scrollbar-gutter:stable] bg-paper px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
