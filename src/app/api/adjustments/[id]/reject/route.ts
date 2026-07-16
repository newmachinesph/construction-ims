import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { rejectAdjustment } from "@/lib/services/stock";

const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const POST = handler(async (req, ctx) => {
  const actor = await requirePermission("adjustment:approve");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, rejectSchema);
  return ok(await rejectAdjustment(actor, id, reason));
});
