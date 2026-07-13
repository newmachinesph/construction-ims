import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { created, handler, ok, parseBody, parseQuery } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { items, categories, uomEnum } from "@/db/schema";
import { moneySchema, paginationSchema, uuidSchema, vatClassSchema } from "@/lib/validation";

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
  sellingPrice: moneySchema.optional(),
  reorderPoint: nonNegQty,
  reorderQty: nonNegQty,
  vatClass: vatClassSchema,
  weightKgPerUom: weightSchema.optional(),
  dpwhPayItem: z.string().trim().max(24).optional(),
  isWeatherSensitive: z.boolean().optional(),
});

/** Whitelisted sortable columns — never order by a client-supplied expression. */
const SORT_COLUMNS = {
  sku: items.sku,
  name: items.name,
  category: categories.name,
  cost: items.standardCost,
  srp: items.sellingPrice,
  reorder: items.reorderPoint,
} as const;

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  sort: z.enum(["sku", "name", "category", "cost", "srp", "reorder"]).optional(),
  dir: z.enum(["asc", "desc"]).default("asc"),
  categoryId: uuidSchema.optional(),
});

export const GET = handler(async (req) => {
  await requirePermission("item:read");
  const { page, pageSize, q, sort, dir, categoryId } = parseQuery(req.url, listQuerySchema);
  const where = and(
    q ? or(ilike(items.sku, `%${q}%`), ilike(items.name, `%${q}%`)) : undefined,
    categoryId ? eq(items.categoryId, categoryId) : undefined,
  );
  const sortCol = SORT_COLUMNS[sort ?? "name"];
  const orderBy = dir === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        uom: items.uom,
        standardCost: items.standardCost,
        sellingPrice: items.sellingPrice,
        reorderPoint: items.reorderPoint,
        isWeatherSensitive: items.isWeatherSensitive,
        isActive: items.isActive,
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(categories, eq(categories.id, items.categoryId))
      .where(where)
      .orderBy(orderBy, asc(items.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(items).where(where),
  ]);

  return ok({ rows, total, page, pageSize });
});

export const POST = handler(async (req) => {
  await requirePermission("item:write");
  const body = await parseBody(req, createItemSchema);
  const [item] = await db.insert(items).values(body).returning();
  return created(item);
});
