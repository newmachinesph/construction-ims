import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { deleteRole, updateRole } from "@/lib/services/roles";

const updateRoleSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  permissions: z.array(z.string()).optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("role:write");
  const { key } = await ctx.params;
  const input = await parseBody(req, updateRoleSchema);
  return ok(await updateRole(actor, key, input));
});

export const DELETE = handler(async (_req, ctx) => {
  const actor = await requirePermission("role:write");
  const { key } = await ctx.params;
  await deleteRole(actor, key);
  return ok({ ok: true });
});
