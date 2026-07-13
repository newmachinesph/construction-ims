import { hasPermission } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { UserMenu } from "./UserMenu";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-4 border-b border-line bg-surface/90 px-4 pl-16 backdrop-blur md:px-6 md:pl-6">
      <UserMenu
        fullName={user.fullName}
        roleLabel={user.roleLabel}
        email={user.email}
        canSettings={hasPermission(user.permissions, "settings:read")}
      />
    </header>
  );
}
