import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companySettings, customers, items, saleItems, sales, stockLevels } from "@/db/schema";
import type { PaymentMethod } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { assertSeparationOfDuties } from "@/lib/rbac";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { computeTotals, lineTotal } from "@/lib/ph";
import { applyMovement, nextDocumentNumber, writeAudit } from "./ledger";

/**
 * The output-VAT rate to charge on a sale, from company settings.
 *
 * Returns 0 when the company is not VAT-registered — a non-VAT taxpayer charges
 * no output VAT at all. This is a company-level setting on purpose: a per-sale
 * "no VAT" switch at the till would be under-remittance to the BIR, so the
 * cashier has no say in it.
 */
export async function outputVatRate(): Promise<number> {
  const settings = await db.query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!settings?.vatRegistered) return 0;
  return Number(settings.vatRate);
}

export interface SaleLineInput {
  itemId: string;
  quantity: string;
  /** VAT-exclusive unit price. Defaults to the item's selling price, but the
   *  counter may negotiate, so this IS a legitimate per-sale override. */
  unitPrice: string;
  // NOTE: no vatClass. BIR tax classification is a property of the item, not of
  // the sale, so it is read from the item master — never accepted from the client.
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

  // Read tax class and catalogue price from the ITEM MASTER, never from the client.
  // A cashier posting straight to the API could otherwise declare a VATable item
  // "EXEMPT" and zero out the 12% output VAT while stock still leaves the shelf
  // and a gapless SI number is consumed — silent under-remittance to the BIR.
  const catalogue = await db
    .select({
      id: items.id,
      sku: items.sku,
      vatClass: items.vatClass,
      sellingPrice: items.sellingPrice,
      isActive: items.isActive,
    })
    .from(items)
    .where(inArray(items.id, input.lines.map((l) => l.itemId)));

  const byId = new Map(catalogue.map((c) => [c.id, c]));
  for (const line of input.lines) {
    const item = byId.get(line.itemId);
    if (!item) throw new NotFoundError(`Item ${line.itemId}`);
    if (!item.isActive) throw new BusinessRuleError(`${item.sku} is inactive and cannot be sold.`);
  }

  const totals = computeTotals(
    input.lines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      vatClass: byId.get(l.itemId)!.vatClass,
    })),
    {
      withholdEwt: false, // We are the seller: output VAT only, no EWT on our own sale.
      vatRate: await outputVatRate(), // company setting, never a per-sale choice
    },
  );

  // A cash sale must record what was handed over. Guarding on `&& amountTendered`
  // would make the whole check opt-in: omit the field and a cash sale posts with
  // no tender recorded and no validation that the cash even covered the bill.
  if (input.paymentMethod === "CASH") {
    if (input.amountTendered === null || input.amountTendered === undefined) {
      throw new BusinessRuleError("A cash sale must record the amount tendered.");
    }
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
      const item = byId.get(line.itemId)!;

      // Post the movement FIRST: it deducts stock under a FOR UPDATE lock and
      // returns the cost the goods actually left at. Re-reading avgUnitCost
      // separately (unlocked) could race a concurrent receipt and freeze a cost
      // on the sale line that disagrees with the ledger for the very same sale.
      // Throws BusinessRuleError if the shelf cannot cover the line.
      const movement = await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        type: "SALE",
        quantity: line.quantity,
        refType: "SALE",
        refId: sale.id,
        refNumber: siNumber,
        actorId: actor.id,
      });

      await tx.insert(saleItems).values({
        saleId: sale.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatClass: item.vatClass, // from the item master, not the client
        lineTotal: lineTotal({ unitPrice: line.unitPrice, quantity: line.quantity }),
        unitCost: movement.unitCost, // the cost actually posted to the ledger
      });
    }

    // Record any line sold below its catalogue price. The counter may legitimately
    // negotiate, so this is not blocked — but a cashier holds `sale:create` without
    // `report:cost`, so systematic under-pricing for an accomplice would otherwise
    // leave no trace at all. Freezing the catalogue price here makes it reviewable.
    const discounted = input.lines
      .map((l) => ({ line: l, item: byId.get(l.itemId)! }))
      .filter(({ line, item }) => Number(line.unitPrice) < Number(item.sellingPrice))
      .map(({ line, item }) => ({
        sku: item.sku,
        catalogPrice: item.sellingPrice,
        chargedPrice: line.unitPrice,
        quantity: line.quantity,
      }));

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SALE_POST",
      entity: "sale",
      entityId: sale.id,
      after: {
        siNumber,
        total: totals.total,
        paymentMethod: input.paymentMethod,
        ...(discounted.length > 0 ? { belowCatalogPrice: discounted } : {}),
      },
    });

    return sale;
  });
}

/**
 * Void a posted sale (wrong item, wrong quantity, customer walked away).
 *
 * BIR: a sales invoice is never deleted — the serial stays consumed and the row
 * stays on the books as CANCELLED, so the series remains gapless. Stock is
 * restored by a compensating SALE_RETURN movement per line, valued at the cost
 * the goods actually left at (frozen on the sale line), so voiding cannot be used
 * to launder the moving-average cost.
 *
 * Separation of duties: the cashier who rang the sale cannot void it. Otherwise a
 * cashier could ring goods out, pocket the cash, and erase the evidence.
 */
export async function voidSale(actor: SessionUser, saleId: string, reason: string) {
  return db.transaction(async (tx) => {
    const sale = await tx.query.sales.findFirst({
      where: eq(sales.id, saleId),
      with: { lines: true },
    });
    if (!sale) throw new NotFoundError("Sale");
    if (sale.status !== "POSTED") {
      throw new ConflictError(`Cannot void a sale in status ${sale.status}.`);
    }

    assertSeparationOfDuties(
      actor.id,
      [sale.createdBy],
      "You cannot void a sale you rang up yourself.",
    );

    for (const line of sale.lines) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: sale.warehouseId,
        type: "SALE_RETURN",
        quantity: line.quantity,
        // Restore at the cost it sold at, not today's average.
        unitCost: line.unitCost,
        refType: "SALE_VOID",
        refId: sale.id,
        refNumber: sale.siNumber,
        notes: reason,
        actorId: actor.id,
      });
    }

    // Status-guarded: a concurrent void updates 0 rows here and rolls back its
    // duplicate SALE_RETURN movements rather than restoring the stock twice.
    const [updated] = await tx
      .update(sales)
      .set({ status: "CANCELLED", notes: reason, updatedAt: new Date() })
      .where(and(eq(sales.id, saleId), eq(sales.status, "POSTED")))
      .returning();
    if (!updated) throw new ConflictError("Sale was already voided.");

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SALE_VOID",
      entity: "sale",
      entityId: sale.id,
      before: { status: "POSTED", total: sale.total },
      after: { status: "CANCELLED", reason },
    });

    return updated;
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
