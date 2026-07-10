import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { receiveTransfer } from "@/lib/services/stock";

export const POST = handler(async (_req, ctx) => {
  const actor = await requirePermission("transfer:receive");
  const { id } = await ctx.params;
  return ok(await receiveTransfer(actor, id));
});
