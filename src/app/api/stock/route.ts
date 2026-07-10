import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { listStock } from "@/lib/services/stock";

export const GET = handler(async () => {
  await requirePermission("stock:read");
  return ok(await listStock());
});
