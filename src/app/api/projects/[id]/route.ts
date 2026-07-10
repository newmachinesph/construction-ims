import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { projects, projectStatusEnum } from "@/db/schema";
import { moneySchema } from "@/lib/validation";
import { writeAudit } from "@/lib/services/ledger";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD.");

const updateProjectSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  clientName: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(240).nullable().optional(),
  status: z.enum(projectStatusEnum.enumValues).optional(),
  startDate: dateStr.nullable().optional(),
  targetEndDate: dateStr.nullable().optional(),
  contractAmount: moneySchema.optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("project:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateProjectSchema);
  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Project");
  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "PROJECT_UPDATE",
    entity: "project",
    entityId: updated.id,
    after: updated,
  });
  return ok(updated);
});
