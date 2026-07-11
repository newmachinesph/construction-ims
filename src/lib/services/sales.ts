import "server-only";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, items, saleItems, sales, stockLevels } from "@/db/schema";
import type { PaymentMethod } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { computeTotals, lineTotal, type TaxLine } from "@/lib/ph";
import { applyMovement, nextDocumentNumber, writeAudit } from "./ledger";

export interface SaleLineInput {
  itemId: string;
  quantity: string;
  /** VAT-exclusive unit price. Defaults to the item's selling price. */
  unitPrice: string;
  vatClass: TaxLine["vatClass"];
}

export interface CreateSaleInput {
  warehouseId: string;
  customerId?: string | null;
  /** Buyer name for a walk-in with no customer record. */
  customerName?: string | null;
  customerTin?: string | null;
  saleDate: string;
  paymentMethod: PaymentMethod;
  amountTendered?: string | null;
  notes?: string;
  lines: SaleLineInput[];
}

/**
 * Ring up and post a counter sale in one transaction.
 *
 * Totals carry OUTPUT VAT (the mirror of input VAT on a purchase), computed
 * server-side from the line vat classes — never trusted from the client.
 * Each line posts a SALE movement, which deducts stock under a FOR UPDATE lock
 * and costs the goods out at the warehouse's moving average. That average is
 * frozen onto the sale line as `unitCost` so margin reporting stays truthful
 * after the average later moves.
 *
 * There is no draft: a sale either posts completely or not at all.
 */
export async function createAndPostSale(actor: SessionUser, input: CreateSaleInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("A sale needs at least one line.");

  // An item whose selling price was never set defaults to 0. Ringing that up
  // would hand stock over for free and post a PHP 0 invoice.
  const unpriced = input.lines.filter((l) => Number(l.unitPrice) <= 0);
  if (unpriced.length > 0) {
    throw new BusinessRuleError(
      "Every sale line needs a unit price above zero. Set the item's selling price, or type the price at the counter.",
    );
  }

  const totals = computeTotals(
    input.lines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      vatClass: l.vatClass,
    })),
    { withholdEwt: false }, // We are the seller: output VAT only, no EWT on our own sale.
  );

  if (input.paymentMethod === "CASH" && input.amountTendered) {
    if (Number(input.amountTendered) + 1e-9 < Number(totals.total)) {
      throw new BusinessRuleError(
        `Cash tendered (${input.amountTendered}) is less than the total due (${totals.total}).`,
      );
    }
  }

  return db.transaction(async (tx) => {
    const siNumber = await nextDocumentNumber(tx, "SI");

    const [sale] = await tx
      .insert(sales)
      .values({
        siNumber,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerTin: input.customerTin ?? null,
        warehouseId: input.warehouseId,
        status: "POSTED",
        saleDate: input.saleDate,
        subtotal: totals.subtotal,
        vatableSales: totals.vatableSales,
        zeroRatedSales: totals.zeroRatedSales,
        exemptSales: totals.exemptSales,
        vatAmount: totals.vatAmount,
        total: totals.total,
        paymentMethod: input.paymentMethod,
        amountTendered: input.amountTendered ?? null,
        notes: input.notes,
        createdBy: actor.id,
        postedAt: new Date(),
      })
      .returning();

    for (const line of input.lines) {
      // Read the moving average BEFORE the movement so the cost we freeze on the
      // line is what these units actually left the shelf at.
      const [level] = await tx
        .select({ avgUnitCost: stockLevels.avgUnitCost })
        .from(stockLevels)
        .where(
          and(eq(stockLevels.itemId, line.itemId), eq(stockLevels.warehouseId, input.warehouseId)),
        );

      await tx.insert(saleItems).values({
        saleId: sale.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatClass: line.vatClass,
        lineTotal: lineTotal({ unitPrice: line.unitPrice, quantity: line.quantity }),
        unitCost: level?.avgUnitCost ?? "0",
      });

      // Deducts stock; throws BusinessRuleError if the shelf can't cover it.
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        type: "SALE",
        quantity: line.quantity,
        refType: "SALE",
        refId: sale.id,
        refNumber: siNumber,
        actorId: actor.id,
      });
    }

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SALE_POST",
      entity: "sale",
      entityId: sale.id,
      after: { siNumber, total: totals.total, paymentMethod: input.paymentMethod },
    });

    return sale;
  });
}

export async function listSales(limit = 50) {
  return db.query.sales.findMany({
    orderBy: [desc(sales.createdAt)],
    limit,
    with: {
      customer: { columns: { name: true } },
      warehouse: { columns: { name: true } },
      cashier: { columns: { fullName: true } },
    },
  });
}

/** `cache()` dedupes the lookup across generateMetadata + the page render, which
 *  both need the sale — one query per request, not two. */
export const getSale = cache(async (id: string) => {
  const sale = await db.query.sales.findFirst({
    where: eq(sales.id, id),
    with: {
      customer: true,
      warehouse: true,
      cashier: { columns: { fullName: true } },
      lines: { with: { item: true } },
    },
  });
  if (!sale) throw new NotFoundError("Sale");
  return sale;
});

/* ----------------------------- customers ---------------------------- */

export async function listCustomers() {
  return db.query.customers.findMany({ orderBy: [desc(customers.createdAt)] });
}

/** Items sellable at the counter: active, with their price and on-hand at a warehouse. */
export async function sellableItems(warehouseId: string) {
  return db
    .select({
      id: items.id,
      sku: items.sku,
      name: items.name,
      uom: items.uom,
      vatClass: items.vatClass,
      sellingPrice: items.sellingPrice,
      qtyOnHand: stockLevels.qtyOnHand,
    })
    .from(items)
    .innerJoin(
      stockLevels,
      and(eq(stockLevels.itemId, items.id), eq(stockLevels.warehouseId, warehouseId)),
    )
    .where(eq(items.isActive, true))
    .orderBy(items.name);
}
