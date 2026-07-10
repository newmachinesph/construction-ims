import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getPurchaseOrder } from "@/lib/services/procurement";

export const GET = handler(async (_req, ctx) => {
  await requirePermission("po:read");
  const { id } = await ctx.params;
  return ok(await getPurchaseOrder(id));
});
