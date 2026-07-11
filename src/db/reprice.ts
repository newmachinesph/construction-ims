import "dotenv/config";
import postgres from "postgres";

/**
 * Set counter selling prices from standard cost, using a per-category markup.
 *
 * Repeatable and non-destructive: it always recomputes `selling_price` from the
 * current `standard_cost`, so re-run it after costs change or after tuning a
 * rate below. Nothing else is touched.
 *
 *   npm run db:reprice            # apply
 *   npm run db:reprice -- --dry   # show what would change, write nothing
 *
 * Rounding is done by Postgres on `numeric`, not in JS floats — the same rule
 * the rest of the money path follows.
 */

/** Markup over standard cost, by category code. Thin on price-shopped
 *  commodities (rebar, cement); fat on small fittings where we are not
 *  competing against a posted price. */
const RATE_CARD: Record<string, number> = {
  CEM: 0.10, // Cement & Concrete — commodity, priced per bag/cu.m
  STL: 0.10, // Steel — rebar is posted-price, highly competitive
  AGG: 0.12, // Aggregates — bulk, delivery-driven
  LUM: 0.18, // Lumber & Formwork
  MAS: 0.18, // Masonry — low unit cost, volume mover
  ROF: 0.22, // Roofing
  FIN: 0.28, // Finishes — spec-driven buyer
  PLB: 0.28, // Plumbing fittings
  ELE: 0.28, // Electrical
  HRD: 0.35, // Hardware — small fittings, best counter margin
};

/** Categories with no rate keep this. Surfaced loudly rather than silently skipped. */
const FALLBACK_RATE = 0.20;

async function main() {
  const dry = process.argv.includes("--dry");
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    const cats = await sql<{ code: string; name: string; items: number }[]>`
      SELECT c.code, c.name, count(i.id)::int AS items
      FROM categories c
      LEFT JOIN items i ON i.category_id = c.id
      GROUP BY c.id, c.code, c.name
      ORDER BY c.code`;

    const unrated = cats.filter((c) => c.items > 0 && RATE_CARD[c.code] === undefined);
    if (unrated.length > 0) {
      console.warn(
        `! No rate for: ${unrated.map((c) => `${c.code} (${c.items} items)`).join(", ")} — using ${FALLBACK_RATE * 100}%.`,
      );
    }

    let total = 0;
    for (const cat of cats) {
      if (cat.items === 0) continue;
      const rate = RATE_CARD[cat.code] ?? FALLBACK_RATE;
      const multiplier = 1 + rate;

      if (dry) {
        const [preview] = await sql<{ n: number; sample: string | null }[]>`
          SELECT count(*)::int AS n,
                 min(i.sku || ': ' || i.standard_cost::text || ' -> ' ||
                     round(i.standard_cost * ${multiplier}, 2)::text) AS sample
          FROM items i
          JOIN categories c ON c.id = i.category_id
          WHERE c.code = ${cat.code}`;
        console.log(
          `${cat.code.padEnd(4)} ${String(Math.round(rate * 100)).padStart(3)}%  ${String(preview.n).padStart(3)} items   e.g. ${preview.sample}`,
        );
        total += preview.n;
        continue;
      }

      const updated = await sql`
        UPDATE items
        SET selling_price = round(standard_cost * ${multiplier}, 2),
            updated_at = now()
        WHERE category_id = (SELECT id FROM categories WHERE code = ${cat.code})
        RETURNING id`;
      console.log(
        `${cat.code.padEnd(4)} ${String(Math.round(rate * 100)).padStart(3)}%  ${String(updated.length).padStart(3)} items repriced`,
      );
      total += updated.length;
    }

    console.log(`\n${dry ? "Would reprice" : "Repriced"} ${total} items.`);

    if (!dry) {
      const [check] = await sql<{ unpriced: number }[]>`
        SELECT count(*)::int AS unpriced FROM items WHERE selling_price <= 0`;
      if (check.unpriced > 0) {
        console.warn(`! ${check.unpriced} item(s) still have no selling price (standard cost is 0).`);
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
