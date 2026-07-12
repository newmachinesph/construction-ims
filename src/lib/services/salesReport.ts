import "server-only";
import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, items, saleItems, sales } from "@/db/schema";

/**
 * Sales reporting over a date range, bucketed daily or monthly.
 *
 * Only POSTED sales count. A CANCELLED (voided) invoice is not revenue — it stays
 * on the books for the BIR, but it must never inflate a sales report.
 */

export type Granularity = "day" | "month";

export interface SalesBucket {
  /** YYYY-MM-DD for a day bucket, YYYY-MM for a month bucket. */
  period: string;
  netSales: number;
  vat: number;
  gross: number;
  cogs: number;
  margin: number;
  invoices: number;
}

export interface CategorySlice {
  name: string;
  netSales: number;
  qty: number;
  /** Cost of goods sold — the moving-average cost frozen on each sale line. */
  cogs: number;
  /** netSales − cogs. The "Net" that gets booked separately from COGS. */
  margin: number;
}

/** One row per item sold in the range — the end-of-day "what went out" list. */
export interface ItemSlice {
  sku: string;
  name: string;
  category: string;
  uom: string;
  /** Pieces / bags / lengths sold. */
  qty: number;
  netSales: number;
  cogs: number;
  margin: number;
}

export interface SalesReport {
  buckets: SalesBucket[];
  byCategory: CategorySlice[];
  byItem: ItemSlice[];
  totals: {
    netSales: number;
    vat: number;
    gross: number;
    cogs: number;
    margin: number;
    invoices: number;
    /** Gross margin as a percentage of net sales. */
    marginPct: number;
    avgSale: number;
  };
}

const POSTED_IN_RANGE = (from: string, to: string) =>
  and(eq(sales.status, "POSTED"), between(sales.saleDate, from, to));

export async function salesReport(
  from: string,
  to: string,
  granularity: Granularity,
): Promise<SalesReport> {
  // Bucket key: 'YYYY-MM-DD' for days, 'YYYY-MM' for months. Done in SQL so
  // Postgres groups, not Node.
  const period =
    granularity === "month"
      ? sql<string>`to_char(${sales.saleDate}, 'YYYY-MM')`
      : sql<string>`to_char(${sales.saleDate}, 'YYYY-MM-DD')`;

  // COGS lives on the sale lines, so it needs its own grouped query rather than
  // being joined into the header aggregate (which would multiply the header
  // money columns by the line count).
  const [headers, lineCosts, byCategory, byItem] = await Promise.all([
    db
      .select({
        period,
        netSales: sql<string>`coalesce(sum(${sales.subtotal}), 0)`,
        vat: sql<string>`coalesce(sum(${sales.vatAmount}), 0)`,
        gross: sql<string>`coalesce(sum(${sales.total}), 0)`,
        invoices: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(POSTED_IN_RANGE(from, to))
      .groupBy(period)
      .orderBy(period),

    db
      .select({
        period,
        cogs: sql<string>`coalesce(sum(${saleItems.quantity} * ${saleItems.unitCost}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(POSTED_IN_RANGE(from, to))
      .groupBy(period)
      .orderBy(period),

    db
      .select({
        name: categories.name,
        netSales: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`,
        qty: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
        cogs: sql<string>`coalesce(sum(${saleItems.quantity} * ${saleItems.unitCost}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(items, eq(items.id, saleItems.itemId))
      .innerJoin(categories, eq(categories.id, items.categoryId))
      .where(POSTED_IN_RANGE(from, to))
      .groupBy(categories.name)
      .orderBy(sql`sum(${saleItems.lineTotal}) desc`),

    // Per-item detail: what actually went out the door, with its own cost.
    db
      .select({
        sku: items.sku,
        name: items.name,
        category: categories.name,
        uom: items.uom,
        qty: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
        netSales: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`,
        cogs: sql<string>`coalesce(sum(${saleItems.quantity} * ${saleItems.unitCost}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(items, eq(items.id, saleItems.itemId))
      .innerJoin(categories, eq(categories.id, items.categoryId))
      .where(POSTED_IN_RANGE(from, to))
      .groupBy(items.sku, items.name, categories.name, items.uom)
      .orderBy(sql`sum(${saleItems.lineTotal}) desc`),
  ]);

  const cogsByPeriod = new Map(lineCosts.map((r) => [r.period, Number(r.cogs)]));

  const buckets: SalesBucket[] = headers.map((h) => {
    const netSales = Number(h.netSales);
    const cogs = cogsByPeriod.get(h.period) ?? 0;
    return {
      period: h.period,
      netSales,
      vat: Number(h.vat),
      gross: Number(h.gross),
      cogs,
      margin: netSales - cogs,
      invoices: h.invoices,
    };
  });

  const sum = (pick: (b: SalesBucket) => number) => buckets.reduce((t, b) => t + pick(b), 0);
  const netSales = sum((b) => b.netSales);
  const cogs = sum((b) => b.cogs);
  const invoices = sum((b) => b.invoices);
  const margin = netSales - cogs;

  return {
    buckets,
    byCategory: byCategory.map((c) => {
      const net = Number(c.netSales);
      const cogs = Number(c.cogs);
      return { name: c.name, netSales: net, qty: Number(c.qty), cogs, margin: net - cogs };
    }),
    byItem: byItem.map((i) => {
      const net = Number(i.netSales);
      const cogs = Number(i.cogs);
      return {
        sku: i.sku,
        name: i.name,
        category: i.category,
        uom: i.uom,
        qty: Number(i.qty),
        netSales: net,
        cogs,
        margin: net - cogs,
      };
    }),
    totals: {
      netSales,
      vat: sum((b) => b.vat),
      gross: sum((b) => b.gross),
      cogs,
      margin,
      invoices,
      marginPct: netSales > 0 ? (margin / netSales) * 100 : 0,
      avgSale: invoices > 0 ? sum((b) => b.gross) / invoices : 0,
    },
  };
}
