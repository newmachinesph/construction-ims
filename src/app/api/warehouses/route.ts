import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { warehouses, warehouseKindEnum } from "@/db/schema";
import { uuidSchema } from "@/lib/validation";

const createWarehouseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(160),
  kind: z.enum(warehouseKindEnum.enumValues).optional(),
  projectId: uuidSchema.optional(),
  address: z.string().trim().max(240).optional(),
});

export const GET = handler(async () => {
  await requirePermission("warehouse:read");
  const rows = await db.query.warehouses.findMany({ orderBy: (t, { asc }) => asc(t.name) });
  return ok(rows);
});

export const POST = handler(async (req) => {
  await requirePermission("warehouse:write");
  const body = await parseBody(req, createWarehouseSchema);
  const [warehouse] = await db.insert(warehouses).values(body).returning();
  return created(warehouse);
});
