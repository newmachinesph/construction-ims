import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createAndDispatchTransfer, listTransfers } from "@/lib/services/stock";
import { qtySchema, uuidSchema } from "@/lib/validation";

const lineSchema = z.object({
  itemId: uuidSchema,
  quantity: qtySchema,
});

const createTransferSchema = z.object({
  fromWarehouseId: uuidSchema,
  toWarehouseId: uuidSchema,
  remarks: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1, "A transfer needs at least one line."),
});

export const GET = handler(async () => {
  await requirePermission("transfer:read");
  return ok(await listTransfers());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("transfer:create");
  const input = await parseBody(req, createTransferSchema);
  return created(await createAndDispatchTransfer(actor, input));
});
