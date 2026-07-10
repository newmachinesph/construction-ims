import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { suppliers, supplierVatStatusEnum } from "@/db/schema";
import { emailSchema, tinSchema } from "@/lib/validation";

const rateSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d(\.\d{1,4})?$/.test(v) && Number(v) >= 0 && Number(v) <= 1, {
    message: "EWT rate must be a fraction between 0 and 1 (up to 4 decimal places).",
  });

const updateSupplierSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  tin: tinSchema.nullable().optional(),
  vatStatus: z.enum(supplierVatStatusEnum.enumValues).optional(),
  ewtApplicable: z.boolean().optional(),
  ewtRate: rateSchema.optional(),
  atcCode: z.string().trim().max(10).optional(),
  contactPerson: z.string().trim().max(160).nullable().optional(),
  email: emailSchema.nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  await requirePermission("supplier:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateSupplierSchema);
  const [updated] = await db
    .update(suppliers)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Supplier");
  return ok(updated);
});
