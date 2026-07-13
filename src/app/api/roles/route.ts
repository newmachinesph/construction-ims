import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createRole, listRolesWithUserCounts } from "@/lib/services/roles";

export const GET = handler(async () => {
  await requirePermission("role:read");
  return ok(await listRolesWithUserCounts());
});

const createRoleSchema = z.object({
  label: z.string().trim().min(1, "A role needs a name.").max(80),
  permissions: z.array(z.string()).default([]),
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("role:write");
  const input = await parseBody(req, createRoleSchema);
  return created(await createRole(actor, input));
});
