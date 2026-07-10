import "server-only";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  companySettings,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanApprovePo } from "@/lib/rbac";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { computeTotals, lineTotal, type TaxLine } from "@/lib/ph";
import { nextDocumentNumber, writeAudit } from "./ledger";

export interface PoLineInput {
  itemId: string;
  qtyOrdered: string;
  unitPrice: string;
  vatClass: TaxLine["vatClass"];
}

export interface CreatePoInput {
  supplierId: string;
  warehouseId: string;
  projectId?: string | null;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string;
  lines: PoLineInput[];
}

/**
 * Create a DRAFT purchase order. Totals (VAT + EWT) are computed server-side
 * from the supplier's tax profile and the company's TWA status — never trusted
 * from the client.
 */
export async function createPurchaseOrder(actor: SessionUser, input: CreatePoInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("A purchase order needs at least one line.");

  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, input.supplierId) });
  if (!supplier) throw new NotFoundError("Supplier");

  const settings = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  const withholdEwt = Boolean(settings?.isTopWithholdingAgent && supplier.ewtApplicable);

  const totals = computeTotals(
    input.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.qtyOrdered, vatClass: l.vatClass })),
    { withholdEwt, ewtRate: Number(supplier.ewtRate) },
  );

  return db.transaction(async (tx) => {
    const poNumber = await nextDocumentNumber(tx, "PO");

    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        projectId: input.projectId ?? null,
        status: "DRAFT",
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        ewtAmount: totals.ewtAmount,
        total: totals.total,
        netPayable: totals.netPayable,
        notes: input.notes,
        createdBy: actor.id,
      })
      .returning();

    await tx.insert(purchaseOrderItems).values(
      input.lines.map((l) => ({
        poId: po.id,
        itemId: l.itemId,
        qtyOrdered: l.qtyOrdered,
        unitPrice: l.unitPrice,
        vatClass: l.vatClass,
        lineTotal: lineTotal({ unitPrice: l.unitPrice, quantity: l.qtyOrdered }),
      })),
    );

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "PO_CREATE",
      entity: "purchase_order",
      entityId: po.id,
      after: { poNumber, total: totals.total },
    });

    return po;
  });
}

/** Move a DRAFT/PENDING PO to APPROVED. Enforces separation of duties. */
export async function approvePurchaseOrder(actor: SessionUser, poId: string) {
  return db.transaction(async (tx) => {
    const po = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) });
    if (!po) throw new NotFoundError("Purchase order");
    if (po.status !== "DRAFT" && po.status !== "PENDING_APPROVAL") {
      throw new ConflictError(`Cannot approve a purchase order in status ${po.status}.`);
    }

    assertCanApprovePo(actor.id, po); // requester != approver

    // Status-guarded write: a concurrent approval that already moved this PO out
    // of DRAFT/PENDING updates 0 rows, so we don't silently overwrite the first
    // approver's separation-of-duties record.
    const [updated] = await tx
      .update(purchaseOrders)
      .set({ status: "APPROVED", approvedBy: actor.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, poId), inArray(purchaseOrders.status, ["DRAFT", "PENDING_APPROVAL"])))
      .returning();
    if (!updated) throw new ConflictError("Purchase order was already processed.");

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "PO_APPROVE",
      entity: "purchase_order",
      entityId: poId,
      before: { status: po.status },
      after: { status: "APPROVED" },
    });

    return updated;
  });
}

export async function cancelPurchaseOrder(actor: SessionUser, poId: string, reason: string) {
  return db.transaction(async (tx) => {
    const po = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) });
    if (!po) throw new NotFoundError("Purchase order");
    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      throw new ConflictError(`Cannot cancel a purchase order in status ${po.status}.`);
    }

    const [updated] = await tx
      .update(purchaseOrders)
      .set({ status: "CANCELLED", cancelledReason: reason, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, poId), notInArray(purchaseOrders.status, ["RECEIVED", "CANCELLED"])))
      .returning();
    if (!updated) throw new ConflictError("Purchase order can no longer be cancelled.");

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "PO_CANCEL",
      entity: "purchase_order",
      entityId: poId,
      before: { status: po.status },
      after: { status: "CANCELLED", reason },
    });

    return updated;
  });
}

export async function listPurchaseOrders(limit = 50) {
  return db.query.purchaseOrders.findMany({
    orderBy: [desc(purchaseOrders.createdAt)],
    limit,
    with: { supplier: true, warehouse: true },
  });
}

export async function getPurchaseOrder(poId: string) {
  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, poId),
    with: { supplier: true, warehouse: true, project: true, lines: { with: { item: true } } },
  });
  if (!po) throw new NotFoundError("Purchase order");
  return po;
}

/** Lines still awaiting delivery, for building a GRN. */
export async function openPoLines(poId: string) {
  return db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, poId))
    .then((lines) => lines.filter((l) => Number(l.qtyReceived) < Number(l.qtyOrdered)));
}

export { and, eq };
