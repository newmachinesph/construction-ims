import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listCategories } from "@/lib/services/categories";
import { listUoms } from "@/lib/services/uom";
import { PageHeader } from "@/components/ui/PageHeader";
import { ItemForm } from "./ItemForm";
import { ItemsImport } from "./ItemsImport";
import { CatalogManager } from "./CatalogManager";
import { ItemsTable } from "./ItemsTable";

export default async function ItemsPage() {
  await requirePermissionPage("item:read");
  const [canWrite, canManageLists] = await Promise.all([can("item:write"), can("category:write")]);

  // Categories + units feed the create form, the CSV importer and the table's
  // filter/labels. Units are now data (the uoms table), not a fixed enum.
  const [categoryRows, uomRows] = await Promise.all([listCategories(), listUoms()]);
  const categories = categoryRows.map((c) => ({ id: c.id, name: c.name }));
  const uoms = uomRows.map((u) => ({ code: u.code, label: u.label }));

  return (
    <>
      <PageHeader
        title="Items"
        description="Material catalog — SKUs, units of measure, and reorder levels."
      />
      {canWrite ? <ItemForm categories={categories} uoms={uoms} /> : null}
      {canWrite ? <ItemsImport /> : null}
      {canManageLists ? <CatalogManager categories={categoryRows} uoms={uomRows} /> : null}
      <ItemsTable categories={categories} uoms={uoms} />
    </>
  );
}
