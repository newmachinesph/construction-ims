import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  auditLogs,
  documentSeries,
  stockLevels,
  stockMovements,
  type DocSeries,
  type MovementType,
} from "@/db/schema";
import { BusinessRuleError } from "@/lib/errors";
import { nextAverageCost, signedQuantity } from "./costing";

export { nextAverageCost, signedQuantity };

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Drizzle does not export a usable concrete tx type for postgres-js. */
export type Tx = PgTransaction<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type DbOrTx = Tx | typeof db;

/* --------------------------- doc numbering -------------------------- */

/**
 * BIR expects gapless, sequential serials per document type. A single
 * `UPDATE ... RETURNING` takes a row lock on the series, so concurrent
 * transactions queue instead of racing to the same number.
 *
 * Consequence: a rolled-back transaction leaves no gap only because the
 * increment rolls back with it. Never allocate a number outside the
 * transaction that inserts the document.
 */
export async function nextDocumentNumber(tx: Tx, series: DocSeries): Promise<string> {
  const rows = await tx
    .update(documentSeries)
    .set({ nextNumber: sql`${documentSeries.nextNumber} + 1` })
    .where(eq(documentSeries.series, series))
    .returning({
      prefix: documentSeries.prefix,
      number: documentSeries.nextNumber,
      padding: documentSeries.padding,
    });

  const row = rows[0];
  if (!row) throw new Error(`Document series not configured: ${series}`);

  // `returning` gives the POST-update value, so the number we just consumed
  // is one less than what the row now holds.
  const consumed = row.number - 1;
  return `${row.prefix}-${String(consumed).padStart(row.padding, "0")}`;
}

/* ----------------------------- movements ---------------------------- */

export interface MovementInput {
  itemId: string;
  warehouseId: string;
  type: MovementType;
  /** Always positive. Direction is derived from `type`. */
  quantity: string;
  /** Required for inbound movements; ignored (and replaced by the running
   *  average) for outbound ones. */
  unitCost?: string;
  projectId?: string | null;
  refType?: string;
  refId?: string;
  refNumber?: string;
  notes?: string;
  actorId: string;
}

/**
 * Apply one movement inside an existing transaction.
 *
 * Takes `FOR UPDATE` on the (item, warehouse) stock row, so two concurrent
 * issues of the last 10 bags of cement cannot both succeed.
 */
export async function applyMovement(tx: Tx, input: MovementInput): Promise<{ balanceAfter: string }> {
  const delta = signedQuantity(input.type, input.quantity);
  if (delta === 0) throw new BusinessRuleError("Movement quantity cannot be zero.");

  // Ensure the row exists, then lock it. ON CONFLICT DO NOTHING is safe under
  // concurrency: the loser of the race simply proceeds to the SELECT.
  await tx
    .insert(stockLevels)
    .values({ itemId: input.itemId, warehouseId: input.warehouseId })
    .onConflictDoNothing();

  const locked = await tx
    .select({
      qtyOnHand: stockLevels.qtyOnHand,
      qtyReserved: stockLevels.qtyReserved,
      avgUnitCost: stockLevels.avgUnitCost,
    })
    .from(stockLevels)
    .where(
      and(eq(stockLevels.itemId, input.itemId), eq(stockLevels.warehouseId, input.warehouseId)),
    )
    .for("update");

  const current = locked[0];
  if (!current) throw new Error("stock_levels row vanished after upsert");

  const onHand = Number(current.qtyOnHand);
  const newBalance = onHand + delta;

  if (newBalance < 0) {
    throw new BusinessRuleError(
      `Insufficient stock: ${onHand} on hand, ${Math.abs(delta)} requested.`,
    );
  }

  const isInbound = delta > 0;
  // A positive ADJUSTMENT (found surplus on a physical count) carries no purchase
  // price, so it must be cost-neutral — value it at the current average, never ₱0,
  // which would silently dilute the moving-average cost of every remaining unit.
  const movementUnitCost = isInbound
    ? (input.unitCost ?? (input.type === "ADJUSTMENT" ? current.avgUnitCost : "0"))
    : current.avgUnitCost;

  const newAvgCost = isInbound
    ? nextAverageCost(current.qtyOnHand, current.avgUnitCost, String(delta), movementUnitCost)
    : current.avgUnitCost;

  const balanceAfter = newBalance.toFixed(3);

  await tx
    .update(stockLevels)
    .set({ qtyOnHand: balanceAfter, avgUnitCost: newAvgCost, updatedAt: new Date() })
    .where(
      and(eq(stockLevels.itemId, input.itemId), eq(stockLevels.warehouseId, input.warehouseId)),
    );

  await tx.insert(stockMovements).values({
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    type: input.type,
    quantity: delta.toFixed(3),
    unitCost: movementUnitCost,
    balanceAfter,
    projectId: input.projectId ?? null,
    refType: input.refType,
    refId: input.refId,
    refNumber: input.refNumber,
    notes: input.notes,
    createdBy: input.actorId,
  });

  return { balanceAfter };
}

/* ---------------------------- reservations -------------------------- */

/**
 * Approving a material requisition reserves stock so a second MR cannot
 * promise the same bags. Reservation never changes qty_on_hand.
 */
export async function reserveStock(
  tx: Tx,
  itemId: string,
  warehouseId: string,
  quantity: string,
): Promise<void> {
  await tx
    .insert(stockLevels)
    .values({ itemId, warehouseId })
    .onConflictDoNothing();

  const locked = await tx
    .select({ qtyOnHand: stockLevels.qtyOnHand, qtyReserved: stockLevels.qtyReserved })
    .from(stockLevels)
    .where(and(eq(stockLevels.itemId, itemId), eq(stockLevels.warehouseId, warehouseId)))
    .for("update");

  const current = locked[0]!;
  const available = Number(current.qtyOnHand) - Number(current.qtyReserved);

  if (Number(quantity) > available) {
    throw new BusinessRuleError(
      `Insufficient unreserved stock: ${available} available, ${quantity} requested.`,
    );
  }

  await tx
    .update(stockLevels)
    .set({ qtyReserved: sql`${stockLevels.qtyReserved} + ${quantity}` })
    .where(and(eq(stockLevels.itemId, itemId), eq(stockLevels.warehouseId, warehouseId)));
}

/** Release a reservation. Clamped at zero so a double-release cannot go negative. */
export async function releaseReservation(
  tx: Tx,
  itemId: string,
  warehouseId: string,
  quantity: string,
): Promise<void> {
  await tx
    .update(stockLevels)
    .set({ qtyReserved: sql`GREATEST(${stockLevels.qtyReserved} - ${quantity}, 0)` })
    .where(and(eq(stockLevels.itemId, itemId), eq(stockLevels.warehouseId, warehouseId)));
}

/* ------------------------------- audit ------------------------------ */

export interface AuditInput {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

/**
 * Append to the audit log. Pass the transaction when the audit must live or
 * die with the change it describes — which is almost always.
 */
export async function writeAudit(client: DbOrTx, input: AuditInput): Promise<void> {
  await client.insert(auditLogs).values({
    actorId: input.actorId,
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}
