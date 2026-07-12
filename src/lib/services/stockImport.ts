import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, items, uomEnum, vatClassEnum, warehouses } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { parseCsvRecords } from "@/lib/csvParse";
import { toCsv } from "@/lib/csv";
import { createAdjustment } from "./stock";
import { writeAudit } from "./ledger";

/**
 * Bulk stock import from a CSV.
 *
 * Two hard rules shape this:
 *
 *  1. It does NOT write stock directly. It raises a DRAFT stock adjustment, which
 *     a SECOND person must approve before any movement posts. Conjuring inventory
 *     from a spreadsheet is exactly what the adjustment approval + separation of
 *     duties exist to prevent; an importer that bypassed them would be a hole
 *     straight through the pilferage control.
 *
 *  2. It is all-or-nothing. Any invalid row fails the whole file. A half-applied
 *     stock import is worse than a rejected one — you cannot tell what landed.
 */

const UOMS = new Set<string>(uomEnum.enumValues);
const VAT_CLASSES = new Set<string>(vatClassEnum.enumValues);

/** The columns of the template, in order. */
export const IMPORT_COLUMNS = [
  { key: "sku", label: "sku", required: true, note: "Existing SKU, or a new one to create" },
  { key: "quantity", label: "quantity", required: true, note: "Qty on hand to load (> 0)" },
  { key: "cost", label: "cost", required: false, note: "Unit cost. Required for a NEW item" },
  { key: "name", label: "name", required: false, note: "Required for a NEW item" },
  { key: "category_code", label: "category_code", required: false, note: "Required for a NEW item" },
  { key: "uom", label: "uom", required: false, note: "Required for a NEW item" },
  { key: "srp", label: "srp", required: false, note: "Retail price. New items only" },
  { key: "vat_class", label: "vat_class", required: false, note: "VATABLE | ZERO_RATED | EXEMPT" },
  { key: "reorder_point", label: "reorder_point", required: false, note: "New items only" },
  { key: "reorder_qty", label: "reorder_qty", required: false, note: "New items only" },
] as const;

export interface ImportRowResult {
  line: number; // 1-based spreadsheet row (header is row 1)
  sku: string;
  name: string;
  quantity: string;
  unitCost: string;
  /** Whether this row will create the item or top up an existing one. */
  action: "create-item" | "existing-item";
  errors: string[];
}

export interface ImportPreview {
  rows: ImportRowResult[];
  newItems: number;
  existingItems: number;
  totalQty: number;
  totalValue: number;
  errorCount: number;
}

/** A blank CSV with the header row and one worked example. */
export function importTemplateCsv(): string {
  const example = {
    sku: "CEM-PC40",
    quantity: "100",
    cost: "300.00",
    name: "Portland Cement Type 1 (40kg)",
    category_code: "CEM",
    uom: "BAG",
    srp: "330.00",
    vat_class: "VATABLE",
    reorder_point: "200",
    reorder_qty: "500",
  };
  return toCsv(
    [example],
    IMPORT_COLUMNS.map((c) => ({ key: c.key as keyof typeof example, label: c.label })),
  );
}

function num(v: string): number {
  return v === "" ? NaN : Number(v);
}

/**
 * Validate a CSV against the catalogue. Pure read — writes nothing. The UI shows
 * this before asking the user to commit, so a bad file is caught before it moves
 * any stock.
 */
export async function previewStockImport(csvText: string, warehouseId: string): Promise<ImportPreview> {
  const warehouse = await db.query.warehouses.findFirst({ where: eq(warehouses.id, warehouseId) });
  if (!warehouse) throw new NotFoundError("Warehouse");

  const { headers, rows } = parseCsvRecords(csvText);
  if (rows.length === 0) throw new BusinessRuleError("The file has no data rows.");
  if (!headers.includes("sku") || !headers.includes("quantity")) {
    throw new BusinessRuleError("The file must have at least a `sku` and a `quantity` column.");
  }
  if (rows.length > 2000) {
    throw new BusinessRuleError("Too many rows (max 2000). Split the file.");
  }

  const skus = rows.map((r) => r.sku).filter(Boolean);
  const [existing, cats] = await Promise.all([
    skus.length > 0
      ? db
          .select({ id: items.id, sku: items.sku, name: items.name, standardCost: items.standardCost })
          .from(items)
          .where(inArray(items.sku, skus))
      : Promise.resolve([]),
    db.select({ code: categories.code }).from(categories),
  ]);

  const bySku = new Map(existing.map((i) => [i.sku, i]));
  const catCodes = new Set(cats.map((c) => c.code));
  const seen = new Set<string>();

  const results: ImportRowResult[] = rows.map((r, i) => {
    const line = i + 2; // +1 for 0-index, +1 for the header row
    const errors: string[] = [];
    const sku = r.sku ?? "";
    const item = bySku.get(sku);
    const isNew = !item;

    if (!sku) errors.push("sku is required");
    else if (seen.has(sku)) errors.push(`duplicate sku "${sku}" — it appears more than once`);
    seen.add(sku);

    const qty = num(r.quantity ?? "");
    if (!Number.isFinite(qty) || qty <= 0) errors.push("quantity must be a number above zero");

    // Cost: required for a new item (otherwise it enters stock valued at zero);
    // for an existing item we fall back to its standard cost.
    const rawCost = r.cost ?? "";
    let unitCost = rawCost;
    if (rawCost === "") {
      if (isNew) errors.push("cost is required for a new item");
      else unitCost = item!.standardCost;
    } else if (!Number.isFinite(num(rawCost)) || num(rawCost) < 0) {
      errors.push("cost must be a non-negative number");
    }

    if (isNew) {
      if (!r.name) errors.push("name is required for a new item");
      if (!r.category_code) errors.push("category_code is required for a new item");
      else if (!catCodes.has(r.category_code)) {
        errors.push(`unknown category_code "${r.category_code}"`);
      }
      if (!r.uom) errors.push("uom is required for a new item");
      else if (!UOMS.has(r.uom)) errors.push(`unknown uom "${r.uom}"`);
    }

    if (r.vat_class && !VAT_CLASSES.has(r.vat_class)) {
      errors.push(`vat_class must be VATABLE, ZERO_RATED or EXEMPT`);
    }

    return {
      line,
      sku,
      name: r.name || item?.name || "",
      quantity: r.quantity ?? "",
      unitCost,
      action: isNew ? "create-item" : "existing-item",
      errors,
    };
  });

  const ok = results.filter((r) => r.errors.length === 0);
  return {
    rows: results,
    newItems: results.filter((r) => r.action === "create-item").length,
    existingItems: results.filter((r) => r.action === "existing-item").length,
    totalQty: ok.reduce((t, r) => t + Number(r.quantity), 0),
    totalValue: ok.reduce((t, r) => t + Number(r.quantity) * Number(r.unitCost || 0), 0),
    errorCount: results.reduce((t, r) => t + r.errors.length, 0),
  };
}

/**
 * Commit an import: create any missing items, then raise ONE draft adjustment
 * carrying every line. Rejects outright if the file has a single error, so the
 * catalogue is never half-created.
 *
 * Returns the DRAFT adjustment — nothing has moved yet. A second person must
 * approve it.
 */
export async function commitStockImport(
  actor: SessionUser,
  csvText: string,
  warehouseId: string,
  remarks?: string,
) {
  const preview = await previewStockImport(csvText, warehouseId);
  if (preview.errorCount > 0) {
    throw new BusinessRuleError(
      `The file has ${preview.errorCount} error(s). Fix them and re-upload — nothing was imported.`,
    );
  }

  const { rows } = parseCsvRecords(csvText);
  const created: string[] = [];

  // Create the missing items first, in their own transaction. If the adjustment
  // below fails, the catalogue rows remain — harmless (an item with no stock),
  // and far better than a half-posted stock movement.
  const lines = await db.transaction(async (tx) => {
    const catRows = await tx.select({ id: categories.id, code: categories.code }).from(categories);
    const catByCode = new Map(catRows.map((c) => [c.code, c.id]));

    const out: { itemId: string; qtyDelta: string; unitCost: string; remarks?: string }[] = [];

    for (const r of rows) {
      const existing = await tx.query.items.findFirst({ where: eq(items.sku, r.sku) });

      let itemId: string;
      let cost = r.cost;

      if (existing) {
        itemId = existing.id;
        if (!cost) cost = existing.standardCost;
      } else {
        const [made] = await tx
          .insert(items)
          .values({
            sku: r.sku,
            name: r.name,
            categoryId: catByCode.get(r.category_code)!,
            uom: r.uom as (typeof uomEnum.enumValues)[number],
            vatClass: (r.vat_class || "VATABLE") as (typeof vatClassEnum.enumValues)[number],
            standardCost: r.cost,
            sellingPrice: r.srp || "0",
            reorderPoint: r.reorder_point || "0",
            reorderQty: r.reorder_qty || "0",
          })
          .returning({ id: items.id });
        itemId = made.id;
        created.push(r.sku);
      }

      out.push({
        itemId,
        qtyDelta: r.quantity, // positive: stock coming in
        unitCost: cost, // so new stock is valued, not booked at zero
        remarks: "Stock import",
      });
    }

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "STOCK_IMPORT_ITEMS_CREATED",
      entity: "item",
      after: { created: created.length, skus: created.slice(0, 50) },
    });

    return out;
  });

  // Raise the DRAFT adjustment. Nothing moves until someone else approves it.
  const adjustment = await createAdjustment(actor, {
    warehouseId,
    reason: "CORRECTION",
    remarks: remarks?.trim() || `Stock import — ${lines.length} line(s), ${created.length} new item(s)`,
    lines,
  });

  return {
    adjustmentId: adjustment.id,
    adjustmentNumber: adjustment.adjustmentNumber,
    itemsCreated: created.length,
    lines: lines.length,
  };
}
