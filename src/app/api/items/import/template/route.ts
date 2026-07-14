import { requirePermission } from "@/lib/auth/dal";
import { fail } from "@/lib/api";
import { itemImportTemplateCsv } from "@/lib/services/itemsImport";

/** Download the item-import template (CSV — Excel opens/saves it natively). */
export async function GET() {
  try {
    await requirePermission("item:write");
    return new Response(itemImportTemplateCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="item-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
