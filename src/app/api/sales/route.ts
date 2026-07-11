import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { created, handler, ok, parseBody } from "@/lib/api";
import {
  moneySchema,
  positiveMoneySchema,
  qtySchema,
  tinSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAndPostSale, listSales } from "@/lib/services/sales";

const saleLineSchema = z.object({
  itemId: uuidSchema,
  quantity: qtySchema,
  // Strictly positive: an item whose selling price was never set must not ring
  // up at PHP 0 — that is a giveaway, not a sale.
  unitPrice: positiveMoneySchema,
  // No vatClass: BIR tax classification is read from the item master server-side.
  // Accepting it here would let a caller declare a VATable item "EXEMPT" and zero
  // out the 12% output VAT.
});

const createSaleSchema = z.object({
  warehouseId: uuidSchema,
  customerId: uuidSchema.nullish(),
  customerName: z.string().trim().max(200).nullish(),
  customerTin: tinSchema.nullish(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
  paymentMethod: z.enum(["CASH", "GCASH", "BANK_TRANSFER", "CHECK", "CARD"]),
  amountTendered: moneySchema.nullish(),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(saleLineSchema).min(1, "A sale needs at least one line."),
}).refine((v) => v.paymentMethod !== "CASH" || v.amountTendered != null, {
  message: "A cash sale must record the amount tendered.",
  path: ["amountTendered"],
});

export const GET = handler(async () => {
  await requirePermission("sale:read");
  return ok(await listSales());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("sale:create");
  const input = await parseBody(req, createSaleSchema);
  const sale = await createAndPostSale(actor, input);
  return created(sale);
});
