import { z } from "zod";
import { created, handler, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createAndPostIssuance } from "@/lib/services/requisition";
import { qtySchema, uuidSchema } from "@/lib/validation";

const lineSchema = z.object({
  mrItemId: uuidSchema,
  quantity: qtySchema,
});

const createIssuanceSchema = z.object({
  mrId: uuidSchema,
  receivedByName: z.string().trim().min(1).max(160),
  lines: z.array(lineSchema).min(1, "An issuance needs at least one line."),
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("issuance:create");
  const input = await parseBody(req, createIssuanceSchema);
  return created(await createAndPostIssuance(actor, input));
});
