import { asc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupplierForm } from "./SupplierForm";
import { SuppliersTable } from "./SuppliersTable";

export default async function SuppliersPage() {
  await requirePermissionPage("supplier:read");
  const canWrite = await can("supplier:write");

  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name));

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Vendor master data — TIN, VAT status, EWT rate, and lead time."
      />
      {canWrite ? <SupplierForm mode="create" /> : null}
      <SuppliersTable rows={rows} canWrite={canWrite} />
    </>
  );
}
