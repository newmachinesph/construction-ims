import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, categories } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ItemForm } from "./ItemForm";
import { ItemsTable } from "./ItemsTable";

export default async function ItemsPage() {
  await requirePermissionPage("item:read");
  const canWrite = await can("item:write");

  const [rows, categoryRows] = await Promise.all([
    db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        uom: items.uom,
        standardCost: items.standardCost,
        reorderPoint: items.reorderPoint,
        reorderQty: items.reorderQty,
        isWeatherSensitive: items.isWeatherSensitive,
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(categories, eq(categories.id, items.categoryId))
      .orderBy(asc(items.name)),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
  ]);

  return (
    <>
      <PageHeader
        title="Items"
        description="Material catalog — SKUs, units of measure, and reorder levels."
      />
      {canWrite ? <ItemForm categories={categoryRows} /> : null}
      <ItemsTable rows={rows} />
    </>
  );
}
