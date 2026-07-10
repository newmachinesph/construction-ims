import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { approveAndPostAdjustment } from "@/lib/services/stock";

export const POST = handler(async (_req, ctx) => {
  const actor = await requirePermission("adjustment:approve");
  const { id } = await ctx.params;
  return ok(await approveAndPostAdjustment(actor, id));
});
