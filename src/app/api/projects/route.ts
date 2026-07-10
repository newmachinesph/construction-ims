import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { projects, projectStatusEnum } from "@/db/schema";
import { moneySchema } from "@/lib/validation";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD.");

const createProjectSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  clientName: z.string().trim().max(200).optional(),
  location: z.string().trim().max(240).optional(),
  status: z.enum(projectStatusEnum.enumValues).optional(),
  startDate: dateStr.optional(),
  targetEndDate: dateStr.optional(),
  contractAmount: moneySchema.optional(),
});

export const GET = handler(async () => {
  await requirePermission("project:read");
  const rows = await db.query.projects.findMany({ orderBy: (t, { asc }) => asc(t.name) });
  return ok(rows);
});

export const POST = handler(async (req) => {
  await requirePermission("project:write");
  const body = await parseBody(req, createProjectSchema);
  const [project] = await db.insert(projects).values(body).returning();
  return created(project);
});
