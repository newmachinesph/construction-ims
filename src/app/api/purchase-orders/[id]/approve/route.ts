import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { approvePurchaseOrder } from "@/lib/services/procurement";

export const POST = handler(async (_req, ctx) => {
  const actor = await requirePermission("po:approve");
  const { id } = await ctx.params;
  return ok(await approvePurchaseOrder(actor, id));
});
