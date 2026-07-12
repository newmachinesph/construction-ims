import { requirePermission } from "@/lib/auth/dal";
import { fail } from "@/lib/api";
import { importTemplateCsv } from "@/lib/services/stockImport";

/**
 * Download the stock-import template. CSV, because Excel opens and saves it
 * natively — a real .xlsx would need a parser dependency for no extra capability.
 */
export async function GET() {
  try {
    await requirePermission("adjustment:create");
    return new Response(importTemplateCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stock-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
