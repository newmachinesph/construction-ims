import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { warehouses, warehouseKindEnum } from "@/db/schema";
import { uuidSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/services/ledger";

const updateWarehouseSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  kind: z.enum(warehouseKindEnum.enumValues).optional(),
  projectId: uuidSchema.nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("warehouse:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateWarehouseSchema);
  const [updated] = await db
    .update(warehouses)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(warehouses.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Warehouse");
  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "WAREHOUSE_UPDATE",
    entity: "warehouse",
    entityId: updated.id,
    after: updated,
  });
  return ok(updated);
});
