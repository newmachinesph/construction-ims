import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, items } from "@/db/schema";
import { can, requirePermissionPage } from "@/lib/auth/dal";
import { PhotoManager } from "@/components/PhotoManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("item:read");
  const { id } = await params;

  const [row] = await db
    .select({
      id: items.id,
      sku: items.sku,
      name: items.name,
      uom: items.uom,
      standardCost: items.standardCost,
      reorderPoint: items.reorderPoint,
      reorderQty: items.reorderQty,
      vatClass: items.vatClass,
      dpwhPayItem: items.dpwhPayItem,
      isWeatherSensitive: items.isWeatherSensitive,
      categoryName: categories.name,
    })
    .from(items)
    .innerJoin(categories, eq(categories.id, items.categoryId))
    .where(eq(items.id, id))
    .limit(1);

  if (!row) notFound();
  const canWrite = await can("item:write");

  const facts: [string, string][] = [
    ["Category", row.categoryName],
    ["Unit of measure", uomLabel(row.uom)],
    ["Standard cost", formatPHP(row.standardCost)],
    ["VAT class", row.vatClass.replace("_", " ")],
    ["Reorder point", `${formatQty(row.reorderPoint)} ${uomLabel(row.uom)}`],
    ["Reorder qty", `${formatQty(row.reorderQty)} ${uomLabel(row.uom)}`],
    ["DPWH pay item", row.dpwhPayItem ?? "—"],
    ["Weather-sensitive", row.isWeatherSensitive ? "Yes" : "No"],
  ];

  return (
    <>
      <PageHeader title={row.name} description={`SKU ${row.sku}`} />

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
