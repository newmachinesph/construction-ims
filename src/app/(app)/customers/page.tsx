import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/services/sales";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomersTable } from "./CustomersTable";
import { NewCustomerPanel } from "./NewCustomerPanel";

export default async function CustomersPage() {
  await requirePermissionPage("customer:read");
  const [rows, canWrite] = await Promise.all([listCustomers(), can("customer:write")]);

  return (
    <>
      <PageHeader title="Customers" description="Buyers for counter sales. Walk-ins need no record." />
      {canWrite ? <NewCustomerPanel /> : null}
      <CustomersTable rows={rows} canWrite={canWrite} />
    </>
  );
}
