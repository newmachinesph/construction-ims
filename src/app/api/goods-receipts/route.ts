import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createAndPostGrn, listGoodsReceipts } from "@/lib/services/receiving";
import { qtySchema, uuidSchema } from "@/lib/validation";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD.");

/** Non-negative quantity (rejected may be 0). */
const nonNegQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) >= 0, {
    message: "Must be a non-negative quantity with up to 3 decimal places.",
  });

const lineSchema = z.object({
  poItemId: uuidSchema,
  qtyReceived: qtySchema,
  qtyRejected: nonNegQty.optional(),
  remarks: z.string().trim().max(500).optional(),
});

const createGrnSchema = z.object({
  poId: uuidSchema,
  supplierDrNumber: z.string().trim().max(60).optional(),
  supplierInvoiceNumber: z.string().trim().max(60).optional(),
  supplierInvoiceDate: dateStr.nullish(),
  receivedDate: dateStr,
  remarks: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1, "A goods receipt needs at least one line."),
});

export const GET = handler(async () => {
  await requirePermission("grn:read");
  return ok(await listGoodsReceipts());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("grn:create");
  const input = await parseBody(req, createGrnSchema);
  return created(await createAndPostGrn(actor, input));
});
