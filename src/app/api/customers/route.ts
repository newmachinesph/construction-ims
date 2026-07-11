import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { created, handler, ok, parseBody } from "@/lib/api";
import { tinSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/services/ledger";
import { listCustomers } from "@/lib/services/sales";

const customerSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  tin: tinSchema.nullish(),
  address: z.string().trim().max(240).nullish(),
  contactPerson: z.string().trim().max(160).nullish(),
  email: z.string().trim().toLowerCase().email().or(z.literal("")).nullish(),
  phone: z.string().trim().max(40).nullish(),
  isActive: z.boolean().default(true),
});

export const GET = handler(async () => {
  await requirePermission("customer:read");
  return ok(await listCustomers());
});

export const POST = handler(async (req) => {
  const actor = await requirePermission("customer:write");
  const input = await parseBody(req, customerSchema);

  const [customer] = await db
    .insert(customers)
    .values({
      code: input.code,
      name: input.name,
      tin: input.tin || null,
      address: input.address || null,
      contactPerson: input.contactPerson || null,
      email: input.email || null,
      phone: input.phone || null,
      isActive: input.isActive,
    })
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CUSTOMER_CREATE",
    entity: "customer",
    entityId: customer.id,
    after: { code: customer.code, name: customer.name },
  });

  return created(customer);
});
