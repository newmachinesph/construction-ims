import { z } from "zod";
import { created, handler, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createUom } from "@/lib/services/uom";

const createUomSchema = z.object({ label: z.string().trim().min(1).max(40) });

// item:write, not category:write — whoever can add an item can add the unit it
// needs, right from the item form. Renames/deletes (the manager) are stricter.
export const POST = handler(async (req) => {
  const actor = await requirePermission("item:write");
  const body = await parseBody(req, createUomSchema);
  return created(await createUom(actor, body));
});
