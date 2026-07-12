import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { IMPORT_COLUMNS } from "@/lib/services/stockImport";
import { ImportStockForm } from "./ImportStockForm";

export default async function ImportStockPage() {
  await requirePermissionPage("adjustment:create");

  const warehouseRows = await db
    .select({ id: warehouses.id, name: warehouses.name })
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.name));

  return (
    <>
      <PageHeader
        title="Import stock"
        description="Load stock from a spreadsheet. Items that don't exist yet are created."
      />

      {warehouseRows.length === 0 ? (
        <p className="text-sm text-muted">Create a warehouse first — there is nowhere to load stock into.</p>
      ) : (
        <>
          <ImportStockForm warehouses={warehouseRows} />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Columns</h2>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <th scope="col" className="px-3 py-2.5 text-left">Column</th>
                    <th scope="col" className="px-3 py-2.5 text-left">Required</th>
                    <th scope="col" className="px-3 py-2.5 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {IMPORT_COLUMNS.map((c) => (
                    <tr key={c.key} className="border-b border-line last:border-0">
                      <td className="tabular px-3 py-2 text-ink">{c.label}</td>
                      <td className="px-3 py-2 text-xs text-muted">{c.required ? "Yes" : "Optional"}</td>
                      <td className="px-3 py-2 text-xs text-muted">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Column order does not matter, and headings are case-insensitive. A row for an existing
              SKU tops up its stock; a row for an unknown SKU creates the item, which is why a new
              item needs a name, category and unit of measure.
            </p>
          </section>
        </>
      )}
    </>
  );
}
