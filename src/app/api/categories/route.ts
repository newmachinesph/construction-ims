import { z } from "zod";
import { created, handler, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { createCategory } from "@/lib/services/categories";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(24).optional(),
});

// item:write so a category can be added right from the item form (see uoms).
export const POST = handler(async (req) => {
  const actor = await requirePermission("item:write");
  const body = await parseBody(req, createCategorySchema);
  return created(await createCategory(actor, body));
});
