import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createAdjustment, listAdjustments } from "@/lib/services/stock";
import { adjustmentReasonEnum } from "@/db/schema";
import { uuidSchema } from "@/lib/validation";

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
  return created(await createAdjustment(actor, input));
});
