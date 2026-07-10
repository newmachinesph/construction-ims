import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createRequisition, listRequisitions } from "@/lib/services/requisition";
import { qtySchema, uuidSchema } from "@/lib/validation";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD.");

const lineSchema = z.object({
  itemId: uuidSchema,
  qtyRequested: qtySchema,
});

const createMrSchema = z.object({
  projectId: uuidSchema,
  warehouseId: uuidSchema,
  neededDate: dateStr,
  purpose: z.string().trim().max(1000).optional(),
  lines: z.array(lineSchema).min(1, "A requisition needs at least one line."),
});

export const GET = handler(async () => {
  await requirePermission("mr:read");
  return ok(await listRequisitions());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("mr:create");
  const input = await parseBody(req, createMrSchema);
  return created(await createRequisition(actor, input));
});
