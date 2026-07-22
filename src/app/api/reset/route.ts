import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { BusinessRuleError } from "@/lib/errors";
import { resetData } from "@/lib/services/reset";

const resetSchema = z.object({
  transactions: z.boolean().default(false),
  catalog: z.boolean().default(false),
  partners: z.boolean().default(false),
  locations: z.boolean().default(false),
  auditLog: z.boolean().default(false),
  /** Typed confirmation — must equal "RESET". */
  confirm: z.string(),
});

/** Destructive: erase selected data. settings:write gate; service also requires ADMIN. */
export const POST = handler(async (req) => {
  const actor = await requirePermission("settings:write");
  const { confirm, ...scopes } = await parseBody(req, resetSchema);
  if (confirm !== "RESET") throw new BusinessRuleError('Type "RESET" to confirm.');
  await resetData(actor, scopes);
  return ok({ reset: true });
});
