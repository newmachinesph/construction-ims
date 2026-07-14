import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, items } from "@/db/schema";
import { can, requirePermissionPage } from "@/lib/auth/dal";
import { PhotoManager } from "@/components/PhotoManager";
import { ItemEditForm } from "../ItemEditForm";
import { ItemDeleteButton } from "../ItemDeleteButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPHP, formatQty } from "@/lib/ph";
import { listUoms } from "@/lib/services/uom";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("item:read");
  const { id } = await params;

  // Fire the round trips together — the category/unit lists are only needed by the
  // (collapsed) edit form, so they must never sit in series ahead of the item.
  const canWrite = await can("item:write");
  const [[row], categoryOptions, uomRows] = await Promise.all([
    db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        uom: items.uom,
        standardCost: items.standardCost,
        sellingPrice: items.sellingPrice,
        reorderPoint: items.reorderPoint,
        reorderQty: items.reorderQty,
        vatClass: items.vatClass,
        dpwhPayItem: items.dpwhPayItem,
        isWeatherSensitive: items.isWeatherSensitive,
        isActive: items.isActive,
        categoryId: items.categoryId,
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(categories, eq(categories.id, items.categoryId))
      .where(eq(items.id, id))
      .limit(1),
    canWrite
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .orderBy(asc(categories.name))
      : Promise.resolve([]),
    listUoms(),
  ]);

  if (!row) notFound();

  const uomLabels = new Map(uomRows.map((u) => [u.code, u.label]));
  const uomLabel = (code: string) => uomLabels.get(code) ?? code;
  const uomOptions = uomRows.map((u) => ({ code: u.code, label: u.label }));

  const facts: [string, string][] = [
    ["Category", row.categoryName],
    ["Unit of measure", uomLabel(row.uom)],
    ["Cost", formatPHP(row.standardCost)],
    ["SRP / Retail price", formatPHP(row.sellingPrice)],
    ["VAT class", row.vatClass.replace("_", " ")],
    ["Reorder point", `${formatQty(row.reorderPoint)} ${uomLabel(row.uom)}`],
    ["Reorder qty", `${formatQty(row.reorderQty)} ${uomLabel(row.uom)}`],
    ["DPWH pay item", row.dpwhPayItem ?? "—"],
    ["Weather-sensitive", row.isWeatherSensitive ? "Yes" : "No"],
  ];

  return (
    <>
      <PageHeader title={row.name} description={`SKU ${row.sku}`} />

      {canWrite ? (
        <div className="flex flex-col gap-3">
          <ItemEditForm
            item={{
              id: row.id,
              sku: row.sku,
              name: row.name,
              categoryId: row.categoryId,
              uom: row.uom,
              sellingPrice: row.sellingPrice,
              vatClass: row.vatClass,
              standardCost: row.standardCost,
              reorderPoint: row.reorderPoint,
              reorderQty: row.reorderQty,
              dpwhPayItem: row.dpwhPayItem,
              isWeatherSensitive: row.isWeatherSensitive,
              isActive: row.isActive,
            }}
            categories={categoryOptions}
            uoms={uomOptions}
          />
          <ItemDeleteButton itemId={row.id} sku={row.sku} />
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
            <div className="mt-1 text-sm text-ink">{value}</div>
          </div>
        ))}
      </section>

      <PhotoManager entity="item" entityId={row.id} canWrite={canWrite} title="Material photos" />
    </>
  );
}
