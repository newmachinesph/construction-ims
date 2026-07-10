import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { recentMovements } from "@/lib/services/stock";

export const GET = handler(async () => {
  await requirePermission("movement:read");
  return ok(await recentMovements());
});
