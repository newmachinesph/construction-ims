import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { approveRequisition } from "@/lib/services/requisition";

export const POST = handler(async (_req, ctx) => {
  const actor = await requirePermission("mr:approve");
  const { id } = await ctx.params;
  return ok(await approveRequisition(actor, id));
});
