import { desc } from "drizzle-orm";
import { handler, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export const GET = handler(async () => {
  await requirePermission("audit:read");
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
  return ok(rows);
});
