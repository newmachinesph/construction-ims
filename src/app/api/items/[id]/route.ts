import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { items } from "@/db/schema";
import { uomExists } from "@/lib/services/uom";
import { deleteItem } from "@/lib/services/items";
import { moneySchema, uuidSchema, vatClassSchema } from "@/lib/validation";

const nonNegQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) >= 0, {
    message: "Must be a non-negative quantity with up to 3 decimal places.",
  });

const weightSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: "Must be a positive number with up to 4 decimal places.",
  });

const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categoryId: uuidSchema.optional(),
  uom: z.string().trim().min(1).max(24).optional(),
  standardCost: moneySchema.optional(),
  sellingPrice: moneySchema.optional(),
  reorderPoint: nonNegQty.optional(),
  reorderQty: nonNegQty.optional(),
  vatClass: vatClassSchema.optional(),
  weightKgPerUom: weightSchema.nullable().optional(),
  dpwhPayItem: z.string().trim().max(24).nullable().optional(),
  isWeatherSensitive: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  await requirePermission("item:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateItemSchema);
  if (body.uom && !(await uomExists(body.uom))) {
    throw new BusinessRuleError(`Unknown unit of measure: ${body.uom}`);
  }
  const [updated] = await db
    .update(items)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Item");
  return ok(updated);
});

export const DELETE = handler(async (_req, ctx) => {
  const actor = await requirePermission("item:write");
  const { id } = await ctx.params;
  await deleteItem(actor, uuidSchema.parse(id));
  return ok({ deleted: true });
});
