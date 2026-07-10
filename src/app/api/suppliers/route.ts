import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { suppliers, supplierVatStatusEnum } from "@/db/schema";
import { emailSchema, tinSchema } from "@/lib/validation";

/** Creditable withholding rate as a fraction, e.g. "0.0100" = 1%. */
const rateSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d(\.\d{1,4})?$/.test(v) && Number(v) >= 0 && Number(v) <= 1, {
    message: "EWT rate must be a fraction between 0 and 1 (up to 4 decimal places).",
  });

const createSupplierSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  tin: tinSchema.optional(),
  vatStatus: z.enum(supplierVatStatusEnum.enumValues).optional(),
  ewtApplicable: z.boolean().optional(),
  ewtRate: rateSchema.optional(),
  atcCode: z.string().trim().max(10).optional(),
  contactPerson: z.string().trim().max(160).optional(),
  email: emailSchema.optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
});

export const GET = handler(async () => {
  await requirePermission("supplier:read");
  const rows = await db.query.suppliers.findMany({ orderBy: (t, { asc }) => asc(t.name) });
  return ok(rows);
});

export const POST = handler(async (req) => {
  await requirePermission("supplier:write");
  const body = await parseBody(req, createSupplierSchema);
  const [supplier] = await db
    .insert(suppliers)
    .values({ ...body, tin: body.tin ? body.tin : null })
    .returning();
  return created(supplier);
});
