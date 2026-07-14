import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { deleteUom, renameUom } from "@/lib/services/uom";

const renameSchema = z.object({ label: z.string().trim().min(1).max(40) });

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("category:write");
  const { code } = await ctx.params;
  const body = await parseBody(req, renameSchema);
  return ok(await renameUom(actor, code, body.label));
});

export const DELETE = handler(async (_req, ctx) => {
  const actor = await requirePermission("category:write");
  const { code } = await ctx.params;
  await deleteUom(actor, code);
  return ok({ deleted: true });
});
