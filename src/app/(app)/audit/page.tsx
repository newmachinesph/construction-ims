import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuditTable } from "./AuditTable";

export default async function AuditPage() {
  await requirePermissionPage("audit:read");

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      actorEmail: auditLogs.actorEmail,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader title="Audit log" description="Every mutating action across the system, newest first." />
      <AuditTable rows={rows} />
    </>
  );
}
