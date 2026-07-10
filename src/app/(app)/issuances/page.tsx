import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { issuances, materialRequisitions } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { IssuancesTable } from "./IssuancesTable";
import { IssueForm } from "./IssueForm";

export default async function IssuancesPage() {
  await requirePermissionPage("issuance:read");
  const canCreate = await can("issuance:create");

  const [issuanceRows, issuableMrs] = await Promise.all([
    db.query.issuances.findMany({
      orderBy: [desc(issuances.createdAt)],
      limit: 50,
      with: { mr: true, warehouse: true, project: true },
    }),
    canCreate
      ? db.query.materialRequisitions.findMany({
          where: inArray(materialRequisitions.status, ["APPROVED", "PARTIALLY_ISSUED"]),
          with: { project: true, warehouse: true, lines: { with: { item: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Issuances" description="Materials released to site against approved requisitions." />

      {canCreate ? <IssueForm mrs={issuableMrs} /> : null}

      <IssuancesTable issuances={issuanceRows} />
    </>
  );
}
