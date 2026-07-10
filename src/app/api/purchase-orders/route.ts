import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/services/procurement";
import { moneySchema, qtySchema, uuidSchema, vatClassSchema } from "@/lib/validation";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD.");

const lineSchema = z.object({
  itemId: uuidSchema,
  qtyOrdered: qtySchema,
  unitPrice: moneySchema,
  vatClass: vatClassSchema,
});

const createPoSchema = z.object({
  supplierId: uuidSchema,
  warehouseId: uuidSchema,
  projectId: uuidSchema.nullish(),
  orderDate: dateStr,
  expectedDate: dateStr.nullish(),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(lineSchema).min(1, "A purchase order needs at least one line."),
});

export const GET = handler(async () => {
  await requirePermission("po:read");
  return ok(await listPurchaseOrders());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("po:create");
  const input = await parseBody(req, createPoSchema);
  return created(await createPurchaseOrder(actor, input));
});
