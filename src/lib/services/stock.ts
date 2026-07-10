import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  items,
  stockAdjustmentItems,
  stockAdjustments,
  stockLevels,
  stockMovements,
  transferItems,
  transfers,
  warehouses,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanApproveAdjustment, assertSeparationOfDuties } from "@/lib/rbac";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { applyMovement, nextDocumentNumber, writeAudit } from "./ledger";

/* ----------------------------- transfers ---------------------------- */

export interface TransferLineInput {
  itemId: string;
  quantity: string;
}

export interface CreateTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  remarks?: string;
  lines: TransferLineInput[];
}

/**
 * Dispatch a stock transfer: deduct from source now (TRANSFER_OUT), mark it
 * IN_TRANSIT. The destination only gains stock when it is received — this
 * models goods physically on a truck between the warehouse and a jobsite.
 */
export async function createAndDispatchTransfer(actor: SessionUser, input: CreateTransferInput) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new BusinessRuleError("Source and destination warehouses must differ.");
  }
  if (input.lines.length === 0) throw new BusinessRuleError("A transfer needs at least one line.");

  return db.transaction(async (tx) => {
    const transferNumber = await nextDocumentNumber(tx, "TRANSFER");
    const [transfer] = await tx
      .insert(transfers)
      .values({
        transferNumber,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: "IN_TRANSIT",
        dispatchedAt: new Date(),
        remarks: input.remarks,
        createdBy: actor.id,
      })
      .returning();

    for (const line of input.lines) {
      await tx.insert(transferItems).values({
        transferId: transfer.id,
        itemId: line.itemId,
        quantity: line.quantity,
      });
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: input.fromWarehouseId,
        type: "TRANSFER_OUT",
        quantity: line.quantity,
        refType: "TRANSFER",
        refId: transfer.id,
        refNumber: transferNumber,
        actorId: actor.id,
      });
    }

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "TRANSFER_DISPATCH",
      entity: "transfer",
      entityId: transfer.id,
      after: { transferNumber },
    });

    return transfer;
  });
}

/** Receive an in-transit transfer at the destination (TRANSFER_IN). */
export async function receiveTransfer(actor: SessionUser, transferId: string) {
  return db.transaction(async (tx) => {
    const transfer = await tx.query.transfers.findFirst({
      where: eq(transfers.id, transferId),
      with: { lines: true },
    });
    if (!transfer) throw new NotFoundError("Transfer");
    if (transfer.status !== "IN_TRANSIT") {
      throw new ConflictError(`Cannot receive a transfer in status ${transfer.status}.`);
    }

    // The person who dispatched the goods cannot also sign for receiving them —
    // otherwise one bodegero round-trips stock between warehouses unwitnessed.
    assertSeparationOfDuties(
      actor.id,
      [transfer.createdBy],
      "You cannot receive a stock transfer you dispatched.",
    );

    for (const line of transfer.lines) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: transfer.toWarehouseId,
        type: "TRANSFER_IN",
        quantity: line.quantity,
        // Value the goods at the cost locked in when they left the source
        // (the TRANSFER_OUT movement), not the source's live average — which may
        // have drifted from later receipts while the truck was on the road.
        unitCost: await dispatchedUnitCost(tx, transfer.id, line.itemId),
        refType: "TRANSFER",
        refId: transfer.id,
        refNumber: transfer.transferNumber,
        actorId: actor.id,
      });
    }

    // Status-guarded write: a concurrent receive that already flipped this out of
    // IN_TRANSIT updates 0 rows here, aborting the transaction and rolling back the
    // duplicate TRANSFER_IN movements above.
    const [updated] = await tx
      .update(transfers)
      .set({ status: "RECEIVED", receivedAt: new Date(), receivedBy: actor.id, updatedAt: new Date() })
      .where(and(eq(transfers.id, transferId), eq(transfers.status, "IN_TRANSIT")))
      .returning();
    if (!updated) throw new ConflictError("Transfer was already received.");

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "TRANSFER_RECEIVE",
      entity: "transfer",
      entityId: transferId,
      after: { status: "RECEIVED" },
    });

    return updated;
  });
}

/** Cost recorded on this transfer's TRANSFER_OUT movement — the price the goods
 *  actually left the source warehouse at, captured at dispatch time. */
async function dispatchedUnitCost(
  tx: Parameters<typeof applyMovement>[0],
  transferId: string,
  itemId: string,
): Promise<string> {
  const [row] = await tx
    .select({ unitCost: stockMovements.unitCost })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.refId, transferId),
        eq(stockMovements.itemId, itemId),
        eq(stockMovements.type, "TRANSFER_OUT"),
      ),
    );
  return row?.unitCost ?? "0";
}

/* ---------------------------- adjustments --------------------------- */

export interface AdjustmentLineInput {
  itemId: string;
  qtyDelta: string; // signed
  remarks?: string;
}

export interface CreateAdjustmentInput {
  warehouseId: string;
  reason: "COUNT_VARIANCE" | "DAMAGE" | "PILFERAGE" | "SPOILAGE" | "CORRECTION";
  remarks?: string;
  lines: AdjustmentLineInput[];
}

/** Raise a DRAFT stock adjustment (needs a separate approver before it posts). */
export async function createAdjustment(actor: SessionUser, input: CreateAdjustmentInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("An adjustment needs at least one line.");
  if (input.lines.some((l) => Number(l.qtyDelta) === 0)) {
    throw new BusinessRuleError("Adjustment lines cannot have a zero delta.");
  }

  return db.transaction(async (tx) => {
    const adjustmentNumber = await nextDocumentNumber(tx, "ADJUSTMENT");
    const [adj] = await tx
      .insert(stockAdjustments)
      .values({
        adjustmentNumber,
        warehouseId: input.warehouseId,
        reason: input.reason,
        status: "DRAFT",
        remarks: input.remarks,
        createdBy: actor.id,
      })
      .returning();

    await tx.insert(stockAdjustmentItems).values(
      input.lines.map((l) => ({
        adjustmentId: adj.id,
        itemId: l.itemId,
        qtyDelta: l.qtyDelta,
        remarks: l.remarks,
      })),
    );

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ADJUSTMENT_CREATE",
      entity: "stock_adjustment",
      entityId: adj.id,
      after: { adjustmentNumber, reason: input.reason },
    });

    return adj;
  });
}

/**
 * Approve and post an adjustment. Segregation of duties is critical here: the
 * person who counted the shortfall (created the adjustment) cannot be the one
 * who approves writing it off — that is the classic pilferage cover-up.
 */
export async function approveAndPostAdjustment(actor: SessionUser, adjId: string) {
  return db.transaction(async (tx) => {
    const adj = await tx.query.stockAdjustments.findFirst({
      where: eq(stockAdjustments.id, adjId),
      with: { lines: true },
    });
    if (!adj) throw new NotFoundError("Stock adjustment");
    if (adj.status !== "DRAFT") throw new ConflictError(`Cannot post an adjustment in status ${adj.status}.`);

    assertCanApproveAdjustment(actor.id, adj); // creator != approver

    for (const line of adj.lines) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: adj.warehouseId,
        type: "ADJUSTMENT",
        quantity: line.qtyDelta, // signed; applyMovement respects the sign
        refType: "ADJUSTMENT",
        refId: adj.id,
        refNumber: adj.adjustmentNumber,
        notes: line.remarks ?? adj.reason,
        actorId: actor.id,
      });
    }

    // Status-guarded write: two concurrent approvals can't both post the same
    // DRAFT adjustment (which would apply the delta to stock twice) — the second
    // matches 0 rows and rolls back its duplicate movements.
    const [updated] = await tx
      .update(stockAdjustments)
      .set({
        status: "POSTED",
        approvedBy: actor.id,
        approvedAt: new Date(),
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(stockAdjustments.id, adjId), eq(stockAdjustments.status, "DRAFT")))
      .returning();
    if (!updated) throw new ConflictError("Stock adjustment was already posted.");

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ADJUSTMENT_POST",
      entity: "stock_adjustment",
      entityId: adjId,
      after: { status: "POSTED", reason: adj.reason },
    });

    return updated;
  });
}

/* ------------------------------ queries ----------------------------- */

/** Stock on hand across every item/warehouse, joined for display. */
export async function listStock() {
  return db
    .select({
      itemId: items.id,
      sku: items.sku,
      name: items.name,
      uom: items.uom,
      categoryId: items.categoryId,
      reorderPoint: items.reorderPoint,
      isWeatherSensitive: items.isWeatherSensitive,
      warehouseId: warehouses.id,
      warehouseName: warehouses.name,
      warehouseKind: warehouses.kind,
      qtyOnHand: stockLevels.qtyOnHand,
      qtyReserved: stockLevels.qtyReserved,
      avgUnitCost: stockLevels.avgUnitCost,
    })
    .from(stockLevels)
    .innerJoin(items, eq(items.id, stockLevels.itemId))
    .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
    .orderBy(asc(items.name));
}

/** Items whose total on-hand is at or below their reorder point. */
export async function lowStockItems() {
  const rows = await db
    .select({
      itemId: items.id,
      sku: items.sku,
      name: items.name,
      uom: items.uom,
      reorderPoint: items.reorderPoint,
      reorderQty: items.reorderQty,
      isWeatherSensitive: items.isWeatherSensitive,
      totalOnHand: sql<string>`coalesce(sum(${stockLevels.qtyOnHand}), 0)`,
    })
    .from(items)
    .leftJoin(stockLevels, eq(stockLevels.itemId, items.id))
    .where(eq(items.isActive, true))
    .groupBy(items.id)
    .having(sql`coalesce(sum(${stockLevels.qtyOnHand}), 0) <= ${items.reorderPoint}`)
    .orderBy(asc(items.name));
  return rows;
}

export async function recentMovements(limit = 30) {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      balanceAfter: stockMovements.balanceAfter,
      refNumber: stockMovements.refNumber,
      createdAt: stockMovements.createdAt,
      itemName: items.name,
      sku: items.sku,
      uom: items.uom,
      warehouseName: warehouses.name,
    })
    .from(stockMovements)
    .innerJoin(items, eq(items.id, stockMovements.itemId))
    .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

export async function listTransfers(limit = 50) {
  return db.query.transfers.findMany({
    orderBy: [desc(transfers.createdAt)],
    limit,
    with: { fromWarehouse: true, toWarehouse: true },
  });
}

export async function listAdjustments(limit = 50) {
  return db.query.stockAdjustments.findMany({
    orderBy: [desc(stockAdjustments.createdAt)],
    limit,
    with: { warehouse: true },
  });
}

export async function getAdjustment(id: string) {
  const adj = await db.query.stockAdjustments.findFirst({
    where: eq(stockAdjustments.id, id),
    with: { warehouse: true, lines: { with: { item: true } } },
  });
  if (!adj) throw new NotFoundError("Stock adjustment");
  return adj;
}
