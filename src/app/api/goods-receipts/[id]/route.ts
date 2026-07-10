import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getGoodsReceipt } from "@/lib/services/receiving";

export const GET = handler(async (_req, ctx) => {
  await requirePermission("grn:read");
  const { id } = await ctx.params;
  return ok(await getGoodsReceipt(id));
});
