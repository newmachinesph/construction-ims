import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getRequisition } from "@/lib/services/requisition";

export const GET = handler(async (_req, ctx) => {
  await requirePermission("mr:read");
  const { id } = await ctx.params;
  return ok(await getRequisition(id));
});
