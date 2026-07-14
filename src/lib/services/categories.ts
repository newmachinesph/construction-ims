import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, items } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "./ledger";

export interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

export async function listCategories(): Promise<CategoryOption[]> {
  return db
    .select({ id: categories.id, code: categories.code, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function categoryExists(id: string): Promise<boolean> {
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).limit(1);
  return rows.length > 0;
}

/** Derive a stable, unique code from a name ("Power Tools" -> "POWER_TOOLS"). */
function codeFromName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 22) || "CAT";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`.slice(0, 24);
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createCategory(
  actor: SessionUser,
  input: { name: string; code?: string },
): Promise<CategoryOption> {
  const name = input.name.trim();
  if (!name) throw new BusinessRuleError("A category needs a name.");

  const existing = await db.select({ code: categories.code }).from(categories);
  const taken = new Set(existing.map((c) => c.code));
  const code = input.code?.trim()
    ? input.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24)
    : codeFromName(name, taken);

  const [row] = await db.insert(categories).values({ code, name }).returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CATEGORY_CREATE",
    entity: "category",
    entityId: row.id,
    after: { code, name },
  });

  return { id: row.id, code: row.code, name: row.name };
}

export async function renameCategory(
  actor: SessionUser,
  id: string,
  input: { name: string },
): Promise<CategoryOption> {
  const name = input.name.trim();
  if (!name) throw new BusinessRuleError("A category needs a name.");
  const current = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!current) throw new NotFoundError("Category");

  const [row] = await db
    .update(categories)
    .set({ name, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CATEGORY_UPDATE",
    entity: "category",
    entityId: id,
    before: { name: current.name },
    after: { name: row.name },
  });

  return { id: row.id, code: row.code, name: row.name };
}

export async function deleteCategory(actor: SessionUser, id: string): Promise<void> {
  const category = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!category) throw new NotFoundError("Category");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.categoryId, id));
  if (count > 0) {
    throw new ConflictError(
      `Cannot delete a category used by ${count} item${count === 1 ? "" : "s"}. Move those items first.`,
    );
  }

  await db.delete(categories).where(eq(categories.id, id));

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CATEGORY_DELETE",
    entity: "category",
    entityId: id,
    before: { code: category.code, name: category.name },
  });
}
