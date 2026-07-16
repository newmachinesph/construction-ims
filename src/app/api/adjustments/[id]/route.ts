import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { getAdjustment, updateDraftAdjustment } from "@/lib/services/stock";
import { adjustmentReasonEnum } from "@/db/schema";
import { moneySchema, uuidSchema } from "@/lib/validation";

export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params;
  await requirePermission("adjustment:read");
  return ok(await getAdjustment(id));
});

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
  unitCost: moneySchema.or(z.literal("")).optional(),
  remarks: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  warehouseId: uuidSchema,
  reason: z.enum(adjustmentReasonEnum.enumValues),
  remarks: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1, "An adjustment needs at least one line."),
});

/** Edit a DRAFT adjustment. Blocked by the service once posted or cancelled. */
export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("adjustment:create");
  const { id } = await ctx.params;
  const input = await parseBody(req, updateSchema);

  // A blank cost box means cost-neutral, not free — collapse it to null.
  const lines = input.lines.map((l) => ({
    ...l,
    unitCost: l.unitCost && l.unitCost !== "" ? l.unitCost : null,
  }));

  return ok(await updateDraftAdjustment(actor, id, { ...input, lines }));
});
