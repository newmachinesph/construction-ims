import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { items, uomEnum } from "@/db/schema";
import { moneySchema, uuidSchema, vatClassSchema } from "@/lib/validation";

/** Non-negative quantity (up to 3 dp) — reorder levels may legitimately be 0. */
const nonNegQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) >= 0, {
    message: "Must be a non-negative quantity with up to 3 decimal places.",
  });

/** Positive mass per UoM (up to 4 dp). */
const weightSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: "Must be a positive number with up to 4 decimal places.",
  });

const createItemSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  categoryId: uuidSchema,
  uom: z.enum(uomEnum.enumValues),
  standardCost: moneySchema,
  reorderPoint: nonNegQty,
  reorderQty: nonNegQty,
  vatClass: vatClassSchema,
  weightKgPerUom: weightSchema.optional(),
  dpwhPayItem: z.string().trim().max(24).optional(),
  isWeatherSensitive: z.boolean().optional(),
});

export const GET = handler(async () => {
  await requirePermission("item:read");
  const rows = await db.query.items.findMany({ orderBy: (t, { asc }) => asc(t.name) });
  return ok(rows);
});

export const POST = handler(async (req) => {
  await requirePermission("item:write");
  const body = await parseBody(req, createItemSchema);
  const [item] = await db.insert(items).values(body).returning();
  return created(item);
});
