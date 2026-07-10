import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getAdjustment } from "@/lib/services/stock";

export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params;
  await requirePermission("adjustment:read");
  return ok(await getAdjustment(id));
});
