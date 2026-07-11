import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { handler, ok, parseBody } from "@/lib/api";
import { uuidSchema } from "@/lib/validation";
import { voidSale } from "@/lib/services/sales";

const voidSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for the void.").max(500),
});

/** Void a posted sale: cancels the invoice and restores stock. Never deletes. */
export const POST = handler(async (req, ctx) => {
  const actor = await requirePermission("sale:void");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, voidSchema);
  return ok(await voidSale(actor, uuidSchema.parse(id), reason));
});
