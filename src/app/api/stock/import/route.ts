import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { created, handler, ok, parseBody } from "@/lib/api";
import { ForbiddenError } from "@/lib/errors";
import { hasPermission } from "@/lib/rbac";
import { uuidSchema } from "@/lib/validation";
import { commitStockImport, previewStockImport } from "@/lib/services/stockImport";

const MAX_CSV_BYTES = 1_000_000; // 1 MB — a 2000-row stock sheet is ~100 KB

const importSchema = z.object({
  csv: z.string().min(1, "The file is empty.").max(MAX_CSV_BYTES, "File too large (max 1 MB)."),
  warehouseId: uuidSchema,
  remarks: z.string().trim().max(500).optional(),
  /** Dry run: validate and report, write nothing. */
  preview: z.boolean().default(true),
});

/**
 * Validate (preview) or commit a stock import.
 *
 * A commit creates missing items and raises a DRAFT adjustment — it never posts
 * stock. Because it can create catalogue rows, it needs `item:write` on top of
 * `adjustment:create`.
 */
export const POST = handler(async (req) => {
  const actor = await requirePermission("adjustment:create");
  const input = await parseBody(req, importSchema);

  if (input.preview) {
    return ok(await previewStockImport(input.csv, input.warehouseId));
  }

  // Committing can create items, which is a separate privilege.
  if (!hasPermission(actor.permissions, "item:write")) {
    throw new ForbiddenError("Importing stock can create items, which needs item:write.");
  }

  return created(await commitStockImport(actor, input.csv, input.warehouseId, input.remarks));
});
