import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { handler, ok, parseQuery } from "@/lib/api";
import { uuidSchema } from "@/lib/validation";
import { sellableItems } from "@/lib/services/sales";

/** Items the counter can sell from a given warehouse: price + on-hand. */
export const GET = handler(async (req) => {
  await requirePermission("sale:create");
  const { warehouseId } = parseQuery(req.url, z.object({ warehouseId: uuidSchema }));
  return ok(await sellableItems(warehouseId));
});
