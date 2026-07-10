import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { handler, ok, parseBody } from "@/lib/api";
import { tinSchema } from "@/lib/validation";
import { NotFoundError } from "@/lib/errors";

export const GET = handler(async () => {
  await requirePermission("settings:read");
  const row = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  return ok(row ?? null);
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tin: tinSchema.optional(),
  address: z.string().trim().max(240).optional(),
  pcabLicenseNo: z.string().trim().max(40).optional(),
  vatRegistered: z.boolean(),
  isTopWithholdingAgent: z.boolean(),
});

/** Upsert the single company-settings row (id = 1). */
export const PATCH = handler(async (req) => {
  await requirePermission("settings:write");
  const body = await parseBody(req, patchSchema);

  const [row] = await db
    .insert(companySettings)
    .values({ id: 1, ...body })
    .onConflictDoUpdate({ target: companySettings.id, set: { ...body, updatedAt: new Date() } })
    .returning();

  if (!row) throw new NotFoundError("Company settings");
  return ok(row);
});
