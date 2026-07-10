import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { rejectRequisition } from "@/lib/services/requisition";

const rejectSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export const POST = handler(async (req, ctx) => {
  const actor = await requirePermission("mr:approve");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, rejectSchema);
  return ok(await rejectRequisition(actor, id, reason));
});
