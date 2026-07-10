import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { cancelPurchaseOrder } from "@/lib/services/procurement";

const cancelSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export const POST = handler(async (req, ctx) => {
  const actor = await requirePermission("po:cancel");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, cancelSchema);
  return ok(await cancelPurchaseOrder(actor, id, reason));
});
