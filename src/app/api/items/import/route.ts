import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { created, handler, ok, parseBody } from "@/lib/api";
import { commitItemsImport, previewItemsImport } from "@/lib/services/itemsImport";

const MAX_CSV_BYTES = 1_000_000; // 1 MB — a 2000-row item sheet is well under this

const importSchema = z.object({
  csv: z.string().min(1, "The file is empty.").max(MAX_CSV_BYTES, "File too large (max 1 MB)."),
  /** Dry run: validate and report, write nothing. */
  preview: z.boolean().default(true),
});

/** Validate (preview) or commit a catalogue import. Creates item rows only. */
export const POST = handler(async (req) => {
  const actor = await requirePermission("item:write");
  const input = await parseBody(req, importSchema);

  if (input.preview) {
    return ok(await previewItemsImport(input.csv));
  }
  return created(await commitItemsImport(actor, input.csv));
});
