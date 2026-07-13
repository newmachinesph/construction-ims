import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ItemForm } from "./ItemForm";
import { ItemsTable } from "./ItemsTable";

export default async function ItemsPage() {
  await requirePermissionPage("item:read");
  const canWrite = await can("item:write");

  // Categories feed the create form and the table's filter; the table fetches
  // its own rows client-side (TanStack Query) with server pagination + search.
  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <>
      <PageHeader
        title="Items"
        description="Material catalog — SKUs, units of measure, and reorder levels."
      />
      {canWrite ? <ItemForm categories={categoryRows} /> : null}
      <ItemsTable categories={categoryRows} />
    </>
  );
}
