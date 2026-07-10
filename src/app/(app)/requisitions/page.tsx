import Link from "next/link";
import { listRequisitions } from "@/lib/services/requisition";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { RequisitionsTable } from "./RequisitionsTable";

export default async function RequisitionsPage() {
  await requirePermissionPage("mr:read");
  const [mrs, canCreate] = await Promise.all([listRequisitions(), can("mr:create")]);

  return (
    <>
      <PageHeader title="Material requisitions" description="Site requests for materials, pending approval and issuance.">
        {canCreate ? (
          <Link href="/requisitions/new">
            <Button>New MR</Button>
          </Link>
        ) : null}
      </PageHeader>

      <RequisitionsTable mrs={mrs} />
    </>
  );
}
