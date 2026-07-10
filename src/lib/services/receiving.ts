import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  goodsReceiptItems,
  goodsReceipts,
  purchaseOrderItems,
  purchaseOrders,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanReceivePo } from "@/lib/rbac";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { applyMovement, nextDocumentNumber, writeAudit } from "./ledger";

export interface GrnLineInput {
  poItemId: string;
  qtyReceived: string;
  qtyRejected?: string;
  remarks?: string;
}

export interface CreateGrnInput {
  poId: string;
  supplierDrNumber?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string | null;
  receivedDate: string;
  remarks?: string;
  lines: GrnLineInput[];
}

/**
 * Receive goods against a PO and POST them to stock in one transaction.
 *
 * Guarantees:
 *  - separation of duties: the receiver did not create or approve the PO;
 *  - no over-receipt: cumulative received quantity cannot exceed ordered;
 *  - accepted quantity (received - rejected) drives the stock movement, so
 *    wet cement / bent rebar recorded as rejected never enters inventory;
 *  - the PO status advances to PARTIALLY_RECEIVED or RECEIVED atomically.
 */
export async function createAndPostGrn(actor: SessionUser, input: CreateGrnInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("A goods receipt needs at least one line.");

  return db.transaction(async (tx) => {
    const po = await tx.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, input.poId),
      with: { lines: true },
    });
    if (!po) throw new NotFoundError("Purchase order");
    if (po.status !== "APPROVED" && po.status !== "PARTIALLY_RECEIVED") {
      throw new ConflictError(`Cannot receive against a purchase order in status ${po.status}.`);
    }

    assertCanReceivePo(actor.id, po); // receiver != creator != approver

    const poLineById = new Map(po.lines.map((l) => [l.id, l]));
    const grnNumber = await nextDocumentNumber(tx, "GRN");

    const [grn] = await tx
      .insert(goodsReceipts)
      .values({
        grnNumber,
        poId: po.id,
        warehouseId: po.warehouseId,
        supplierDrNumber: input.supplierDrNumber,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        supplierInvoiceDate: input.supplierInvoiceDate ?? null,
        receivedDate: input.receivedDate,
        status: "POSTED",
        remarks: input.remarks,
        createdBy: actor.id,
        postedAt: new Date(),
      })
      .returning();

    for (const line of input.lines) {
      const poLine = poLineById.get(line.poItemId);
      if (!poLine) throw new BusinessRuleError(`PO line ${line.poItemId} does not belong to this PO.`);

      const received = Number(line.qtyReceived);
      const rejected = Number(line.qtyRejected ?? "0");
      const accepted = received - rejected;
      if (accepted < 0) throw new BusinessRuleError("Rejected quantity exceeds received quantity.");

      // Advance the PO line's received counter with the over-receipt cap checked
      // inside the UPDATE's WHERE. Validating against live DB state (not the cached
      // `poLine` snapshot) closes both the duplicate-line-in-one-request and the
      // concurrent-GRN vectors that a stale in-memory check would let through.
      const [advanced] = await tx
        .update(purchaseOrderItems)
        .set({ qtyReceived: sql`${purchaseOrderItems.qtyReceived} + ${accepted}` })
        .where(
          and(
            eq(purchaseOrderItems.id, poLine.id),
            sql`${purchaseOrderItems.qtyReceived} + ${accepted} <= ${purchaseOrderItems.qtyOrdered} + 1e-9`,
          ),
        )
        .returning({ id: purchaseOrderItems.id });
      if (!advanced) {
        throw new BusinessRuleError(
          `Over-receipt on ${poLine.itemId}: cumulative received would exceed ${poLine.qtyOrdered} ordered.`,
        );
      }

      await tx.insert(goodsReceiptItems).values({
        grnId: grn.id,
        poItemId: poLine.id,
        itemId: poLine.itemId,
        qtyReceived: line.qtyReceived,
        qtyRejected: line.qtyRejected ?? "0",
        unitCost: poLine.unitPrice,
        remarks: line.remarks,
      });

      // Only accepted goods hit stock, costed at the PO price.
      if (accepted > 0) {
        await applyMovement(tx, {
          itemId: poLine.itemId,
          warehouseId: po.warehouseId,
          type: "RECEIPT",
          quantity: String(accepted),
          unitCost: poLine.unitPrice,
          projectId: po.projectId,
          refType: "GRN",
          refId: grn.id,
          refNumber: grnNumber,
          actorId: actor.id,
        });
      }
    }

    // Recompute PO status from the freshly-updated line counters.
    const refreshed = await tx
      .select({
        ordered: purchaseOrderItems.qtyOrdered,
        received: purchaseOrderItems.qtyReceived,
      })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, po.id));

    const fullyReceived = refreshed.every((l) => Number(l.received) >= Number(l.ordered) - 1e-9);
    const anyReceived = refreshed.some((l) => Number(l.received) > 0);
    const nextStatus = fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status;

    await tx
      .update(purchaseOrders)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, po.id));

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "GRN_POST",
      entity: "goods_receipt",
      entityId: grn.id,
      after: { grnNumber, poNumber: po.poNumber, status: nextStatus },
    });

    return grn;
  });
}

export async function listGoodsReceipts(limit = 50) {
  return db.query.goodsReceipts.findMany({
    orderBy: [desc(goodsReceipts.createdAt)],
    limit,
    with: { po: { with: { supplier: true } }, warehouse: true },
  });
}

export async function getGoodsReceipt(id: string) {
  const grn = await db.query.goodsReceipts.findFirst({
    where: eq(goodsReceipts.id, id),
    with: { po: { with: { supplier: true } }, warehouse: true, lines: { with: { item: true } } },
  });
  if (!grn) throw new NotFoundError("Goods receipt");
  return grn;
}
