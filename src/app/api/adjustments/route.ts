import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createAdjustment, listAdjustments } from "@/lib/services/stock";
import { adjustmentReasonEnum } from "@/db/schema";
import { moneySchema, uuidSchema } from "@/lib/validation";

/** Signed, non-zero quantity delta (up to 3 dp). */
const signedQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^-?\d+(\.\d{1,3})?$/.test(v) && Number(v) !== 0, {
    message: "Must be a non-zero quantity with up to 3 decimal places.",
  });

const lineSchema = z.object({
  itemId: uuidSchema,
  qtyDelta: signedQty,
  /**
   * Unit cost for a POSITIVE delta. Optional and empty-string-tolerant:
   *   blank -> cost-neutral, value the stock at the warehouse's current moving
   *            average (correct for a count variance — no money changed hands).
   *   set   -> value it at this cost. Required in practice when adding the FIRST
   *            stock of an item, whose average is still 0 — otherwise it books at 0.
   */
  unitCost: moneySchema.or(z.literal("")).optional(),
  remarks: z.string().trim().max(500).optional(),
});

const createAdjustmentSchema = z.object({
  warehouseId: uuidSchema,
  reason: z.enum(adjustmentReasonEnum.enumValues),
  remarks: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1, "An adjustment needs at least one line."),
});

export const GET = handler(async () => {
  await requirePermission("adjustment:read");
  return ok(await listAdjustments());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("adjustment:create");
  const input = await parseBody(req, createAdjustmentSchema);

  // A blank cost box means "cost-neutral", not "free". Collapse it to null so the
  // service values the stock at the current moving average instead of PHP 0.
  const lines = input.lines.map((l) => ({
    ...l,
    unitCost: l.unitCost && l.unitCost !== "" ? l.unitCost : null,
  }));

  return created(await createAdjustment(actor, { ...input, lines }));
});
