import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { handler, ok, parseBody } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { tinSchema, uuidSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/services/ledger";

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tin: tinSchema.nullish(),
  address: z.string().trim().max(240).nullish(),
  contactPerson: z.string().trim().max(160).nullish(),
  email: z.string().trim().toLowerCase().email().or(z.literal("")).nullish(),
  phone: z.string().trim().max(40).nullish(),
  isActive: z.boolean(),
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("customer:write");
  const { id } = await ctx.params;
  const customerId = uuidSchema.parse(id);
  const input = await parseBody(req, updateCustomerSchema);

  const before = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
  if (!before) throw new NotFoundError("Customer");

  const [updated] = await db
    .update(customers)
    .set({
      name: input.name,
      tin: input.tin || null,
      address: input.address || null,
      contactPerson: input.contactPerson || null,
      email: input.email || null,
      phone: input.phone || null,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CUSTOMER_UPDATE",
    entity: "customer",
    entityId: customerId,
    before: { name: before.name, isActive: before.isActive },
    after: { name: updated.name, isActive: updated.isActive },
  });

  return ok(updated);
});
