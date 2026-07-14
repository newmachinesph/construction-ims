import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { uuidSchema } from "@/lib/validation";
import { deleteCategory, renameCategory } from "@/lib/services/categories";

const renameSchema = z.object({ name: z.string().trim().min(1).max(120) });

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("category:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, renameSchema);
  return ok(await renameCategory(actor, uuidSchema.parse(id), body));
});

export const DELETE = handler(async (_req, ctx) => {
  const actor = await requirePermission("category:write");
  const { id } = await ctx.params;
  await deleteCategory(actor, uuidSchema.parse(id));
  return ok({ deleted: true });
});
