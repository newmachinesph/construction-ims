import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, items, uoms, vatClassEnum } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError } from "@/lib/errors";
import { parseCsvRecords } from "@/lib/csvParse";
import { toCsv } from "@/lib/csv";
import { buildUomMatcher, createUom, normalizeUomKey } from "./uom";
import { createCategory } from "./categories";
import { writeAudit } from "./ledger";

/**
 * Bulk item (catalogue) import from a CSV. Creates item master rows only — it
 * moves NO stock, so unlike the stock import it needs no adjustment/approval:
 * a catalogue row with zero on-hand is harmless. Opening balances are a separate
 * step (the stock import), by design.
 *
 * All-or-nothing on errors: one invalid row fails the whole file, so the
 * catalogue is never left half-created. Rows whose SKU already exists are skipped
 * (never overwritten), not treated as errors.
 */

const VAT_CLASSES = new Set<string>(vatClassEnum.enumValues);

export const ITEM_IMPORT_COLUMNS = [
  { key: "sku", label: "sku", note: "Unique item code (new)" },
  { key: "name", label: "name", note: "Item name" },
  { key: "category", label: "category", note: "Category code or name, e.g. HRD or Hardware" },
  { key: "uom", label: "uom", note: "Unit code or label, e.g. PC or pc" },
  { key: "cost", label: "cost", note: "Standard cost, VAT-exclusive (default 0)" },
  { key: "srp", label: "srp", note: "Retail / selling price (default 0)" },
  { key: "vat_class", label: "vat_class", note: "VATABLE | ZERO_RATED | EXEMPT (default VATABLE)" },
  { key: "reorder_point", label: "reorder_point", note: "Low-stock trigger (default 0)" },
  { key: "reorder_qty", label: "reorder_qty", note: "Suggested reorder qty (default 0)" },
  { key: "weather_sensitive", label: "weather_sensitive", note: "yes / no (default no)" },
] as const;

export interface ItemImportRow {
  line: number;
  sku: string;
  name: string;
  action: "create" | "skip-existing";
  errors: string[];
}

export interface ItemImportPreview {
  rows: ItemImportRow[];
  toCreate: number;
  toSkip: number;
  /** Distinct categories/units in the file that don't exist yet — created on commit. */
  newCategories: number;
  newUnits: number;
  errorCount: number;
}

/** A blank CSV with the header row and one worked example. */
export function itemImportTemplateCsv(): string {
  const example = {
    sku: "HRD-HAMMER",
    name: "Claw Hammer 16oz",
    category: "HRD",
    uom: "pc",
    cost: "180.00",
    srp: "250.00",
    vat_class: "VATABLE",
    reorder_point: "10",
    reorder_qty: "30",
    weather_sensitive: "no",
  };
  return toCsv(
    [example],
    ITEM_IMPORT_COLUMNS.map((c) => ({ key: c.key as keyof typeof example, label: c.label })),
  );
}

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const QTY_RE = /^\d+(\.\d{1,3})?$/;

function isTruthy(v: string): boolean {
  return ["yes", "y", "true", "1"].includes(v.trim().toLowerCase());
}

/** Strip thousand-separator commas Excel writes ("1,160.00" -> "1160.00"). */
function cleanNum(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/,/g, "");
}

/** Parse + validate the file against the catalogue. Pure read — writes nothing. */
export async function previewItemsImport(csvText: string): Promise<ItemImportPreview> {
  const { headers, rows } = parseCsvRecords(csvText);
  if (rows.length === 0) throw new BusinessRuleError("The file has no data rows.");
  for (const required of ["sku", "name", "category", "uom"]) {
    if (!headers.includes(required)) {
      throw new BusinessRuleError(`The file must have a \`${required}\` column.`);
    }
  }
  if (rows.length > 2000) throw new BusinessRuleError("Too many rows (max 2000). Split the file.");

  const skus = rows.map((r) => r.sku).filter(Boolean);
  const [existing, cats, uomRows] = await Promise.all([
    skus.length > 0
      ? db.select({ sku: items.sku }).from(items).where(inArray(items.sku, skus))
      : Promise.resolve([]),
    db.select({ code: categories.code, name: categories.name }).from(categories),
    db.select({ code: uoms.code, label: uoms.label }).from(uoms),
  ]);

  const existingSkus = new Set(existing.map((i) => i.sku));
  const matchUom = buildUomMatcher(uomRows);
  const catByKey = new Map<string, string>();
  for (const c of cats) {
    catByKey.set(normalizeUomKey(c.code), c.code);
    catByKey.set(normalizeUomKey(c.name), c.code);
  }
  const seen = new Set<string>();
  // A category/unit in the file but not the catalogue isn't an error — it is
  // created on commit. Dedup by normalized key so each is made once.
  const newCategoryNames = new Map<string, string>();
  const newUnitLabels = new Map<string, string>();

  const results: ItemImportRow[] = rows.map((r, i) => {
    const line = i + 2; // +1 for 0-index, +1 for the header row
    const errors: string[] = [];
    const sku = (r.sku ?? "").trim();

    if (!sku) errors.push("sku is required");
    else if (seen.has(sku)) errors.push(`duplicate sku "${sku}" — it appears more than once`);
    seen.add(sku);

    const alreadyExists = existingSkus.has(sku);

    if (!alreadyExists) {
      if (!r.name) errors.push("name is required");
      if (!r.category) errors.push("category is required");
      else if (!catByKey.has(normalizeUomKey(r.category))) {
        newCategoryNames.set(normalizeUomKey(r.category), r.category.trim());
      }
      if (!r.uom) errors.push("uom is required");
      else if (!matchUom(r.uom)) newUnitLabels.set(normalizeUomKey(r.uom), r.uom.trim());

      for (const [field, re, kind] of [
        ["cost", MONEY_RE, "money"],
        ["srp", MONEY_RE, "money"],
        ["reorder_point", QTY_RE, "quantity"],
        ["reorder_qty", QTY_RE, "quantity"],
      ] as const) {
        const raw = cleanNum(r[field]);
        if (raw !== "" && !re.test(raw)) errors.push(`${field} must be a non-negative ${kind}`);
      }
      if (r.vat_class && !VAT_CLASSES.has(r.vat_class.trim().toUpperCase())) {
        errors.push("vat_class must be VATABLE, ZERO_RATED or EXEMPT");
      }
    }

    return {
      line,
      sku,
      name: r.name ?? "",
      action: alreadyExists ? "skip-existing" : "create",
      errors,
    };
  });

  return {
    rows: results,
    toCreate: results.filter((r) => r.action === "create" && r.errors.length === 0).length,
    toSkip: results.filter((r) => r.action === "skip-existing").length,
    newCategories: newCategoryNames.size,
    newUnits: newUnitLabels.size,
    errorCount: results.reduce((t, r) => t + r.errors.length, 0),
  };
}

/** Create every valid, new item in one transaction. Rejects on any error. */
export async function commitItemsImport(actor: SessionUser, csvText: string) {
  const preview = await previewItemsImport(csvText);
  if (preview.errorCount > 0) {
    throw new BusinessRuleError(
      `The file has ${preview.errorCount} error(s). Fix them and re-upload — nothing was imported.`,
    );
  }

  const { rows } = parseCsvRecords(csvText);

  const [existingItems, existingCats, existingUoms] = await Promise.all([
    db.select({ sku: items.sku }).from(items),
    db.select({ code: categories.code, name: categories.name }).from(categories),
    db.select({ code: uoms.code, label: uoms.label }).from(uoms),
  ]);
  const existingSkus = new Set(existingItems.map((i) => i.sku));
  const catKeys = new Set<string>();
  for (const c of existingCats) {
    catKeys.add(normalizeUomKey(c.code));
    catKeys.add(normalizeUomKey(c.name));
  }
  const uomMatch = buildUomMatcher(existingUoms);
  const rowsToCreate = rows.filter((r) => !existingSkus.has(r.sku.trim()));

  // Create the categories/units the file needs but the catalogue lacks — once
  // each. Done before the item transaction; if that later fails, these remain as
  // harmless empty master rows (same trade-off as the stock importer).
  let newCategories = 0;
  const madeCatKeys = new Set<string>();
  for (const r of rowsToCreate) {
    const key = normalizeUomKey(r.category);
    if (!catKeys.has(key) && !madeCatKeys.has(key)) {
      await createCategory(actor, { name: r.category.trim() });
      madeCatKeys.add(key);
      newCategories++;
    }
  }
  let newUnits = 0;
  const madeUomKeys = new Set<string>();
  for (const r of rowsToCreate) {
    const key = normalizeUomKey(r.uom);
    if (!uomMatch(r.uom) && !madeUomKeys.has(key)) {
      await createUom(actor, { label: r.uom.trim() });
      madeUomKeys.add(key);
      newUnits++;
    }
  }

  const createdSkus = await db.transaction(async (tx) => {
    const [cats, uomRows] = await Promise.all([
      tx.select({ id: categories.id, code: categories.code, name: categories.name }).from(categories),
      tx.select({ code: uoms.code, label: uoms.label }).from(uoms),
    ]);
    const catIdByKey = new Map<string, string>();
    for (const c of cats) {
      catIdByKey.set(normalizeUomKey(c.code), c.id);
      catIdByKey.set(normalizeUomKey(c.name), c.id);
    }
    const matchUom = buildUomMatcher(uomRows);

    const created: string[] = [];
    const seen = new Set(existingSkus); // skip existing + guard same-file dups
    for (const r of rows) {
      const sku = r.sku.trim();
      if (seen.has(sku)) continue;
      seen.add(sku);

      await tx.insert(items).values({
        sku,
        name: r.name,
        categoryId: catIdByKey.get(normalizeUomKey(r.category))!,
        uom: matchUom(r.uom)!,
        vatClass: (r.vat_class ? r.vat_class.toUpperCase() : "VATABLE") as (typeof vatClassEnum.enumValues)[number],
        standardCost: cleanNum(r.cost) || "0",
        sellingPrice: cleanNum(r.srp) || "0",
        reorderPoint: cleanNum(r.reorder_point) || "0",
        reorderQty: cleanNum(r.reorder_qty) || "0",
        isWeatherSensitive: r.weather_sensitive ? isTruthy(r.weather_sensitive) : false,
      });
      created.push(sku);
    }

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ITEMS_IMPORT",
      entity: "item",
      after: { created: created.length, newCategories, newUnits, skus: created.slice(0, 50) },
    });

    return created;
  });

  return { itemsCreated: createdSkus.length, skipped: preview.toSkip, newCategories, newUnits };
}
