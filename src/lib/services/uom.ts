import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, uoms } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "./ledger";

export interface UomOption {
  code: string;
  label: string;
  isSystem: boolean;
}

/** Active units for pickers and display, alphabetised by label. */
export async function listUoms(): Promise<UomOption[]> {
  return db
    .select({ code: uoms.code, label: uoms.label, isSystem: uoms.isSystem })
    .from(uoms)
    .where(eq(uoms.isActive, true))
    .orderBy(asc(uoms.label));
}

/** code -> label, for rendering a stored uom code anywhere the label is shown. */
export async function uomLabelMap(): Promise<Record<string, string>> {
  const rows = await db.select({ code: uoms.code, label: uoms.label }).from(uoms);
  return Object.fromEntries(rows.map((r) => [r.code, r.label]));
}

export async function uomExists(code: string): Promise<boolean> {
  const rows = await db.select({ code: uoms.code }).from(uoms).where(eq(uoms.code, code)).limit(1);
  return rows.length > 0;
}

/**
 * Forgiving match for spreadsheet input. A human filling a CSV types "bag",
 * "Roll", "cu.m" — not the stored code "BAG" / "ROLL" / "CU_M". This normalises
 * both sides (lowercase, punctuation stripped) so any of them resolve, instead
 * of the old exact-key check where only a row that happened to already read as
 * an enum key passed. Returns the canonical code, or null if nothing matches.
 */
export function normalizeUomKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildUomMatcher(rows: { code: string; label: string }[]): (raw: string) => string | null {
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(normalizeUomKey(r.code), r.code);
    map.set(normalizeUomKey(r.label), r.code);
  }
  return (raw: string) => map.get(normalizeUomKey(raw)) ?? null;
}

/** Derive a stable, unique code from a human label ("Drum (200L)" -> "DRUM_200L"). */
function codeFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 22) || "UOM";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`.slice(0, 24);
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createUom(actor: SessionUser, input: { label: string }): Promise<UomOption> {
  const label = input.label.trim();
  if (!label) throw new BusinessRuleError("A unit needs a name.");

  const existing = await db.select({ code: uoms.code }).from(uoms);
  const code = codeFromLabel(label, new Set(existing.map((u) => u.code)));

  const [row] = await db.insert(uoms).values({ code, label, isSystem: false }).returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "UOM_CREATE",
    entity: "uom",
    entityId: code,
    after: { code, label },
  });

  return { code: row.code, label: row.label, isSystem: row.isSystem };
}

export async function renameUom(actor: SessionUser, code: string, label: string): Promise<UomOption> {
  const trimmed = label.trim();
  if (!trimmed) throw new BusinessRuleError("A unit needs a name.");
  const current = await db.query.uoms.findFirst({ where: eq(uoms.code, code) });
  if (!current) throw new NotFoundError("Unit");

  const [row] = await db
    .update(uoms)
    .set({ label: trimmed, updatedAt: new Date() })
    .where(eq(uoms.code, code))
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "UOM_UPDATE",
    entity: "uom",
    entityId: code,
    before: { label: current.label },
    after: { label: row.label },
  });

  return { code: row.code, label: row.label, isSystem: row.isSystem };
}

export async function deleteUom(actor: SessionUser, code: string): Promise<void> {
  const uom = await db.query.uoms.findFirst({ where: eq(uoms.code, code) });
  if (!uom) throw new NotFoundError("Unit");
  if (uom.isSystem) throw new ForbiddenError("Built-in units cannot be deleted.");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.uom, code));
  if (count > 0) {
    throw new ConflictError(
      `Cannot delete a unit used by ${count} item${count === 1 ? "" : "s"}. Change those items first.`,
    );
  }

  await db.delete(uoms).where(eq(uoms.code, code));

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "UOM_DELETE",
    entity: "uom",
    entityId: code,
    before: { code: uom.code, label: uom.label },
  });
}
