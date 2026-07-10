import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  issuanceItems,
  issuances,
  materialRequisitionItems,
  materialRequisitions,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanApproveMr } from "@/lib/rbac";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import {
  applyMovement,
  nextDocumentNumber,
  releaseReservation,
  reserveStock,
  writeAudit,
} from "./ledger";

export interface MrLineInput {
  itemId: string;
  qtyRequested: string;
}

export interface CreateMrInput {
  projectId: string;
  warehouseId: string;
  neededDate: string;
  purpose?: string;
  lines: MrLineInput[];
}

/** Site engineer raises a material requisition (DRAFT -> SUBMITTED). */
export async function createRequisition(actor: SessionUser, input: CreateMrInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("A requisition needs at least one line.");

  return db.transaction(async (tx) => {
    const mrNumber = await nextDocumentNumber(tx, "MR");
    const [mr] = await tx
      .insert(materialRequisitions)
      .values({
        mrNumber,
        projectId: input.projectId,
        warehouseId: input.warehouseId,
        status: "SUBMITTED",
        neededDate: input.neededDate,
        purpose: input.purpose,
        requestedBy: actor.id,
      })
      .returning();

    await tx.insert(materialRequisitionItems).values(
      input.lines.map((l) => ({ mrId: mr.id, itemId: l.itemId, qtyRequested: l.qtyRequested })),
    );

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "MR_CREATE",
      entity: "material_requisition",
      entityId: mr.id,
      after: { mrNumber },
    });

    return mr;
  });
}

/**
 * Approve an MR and reserve the requested stock at its source warehouse.
 * Reservation prevents a second MR from promising the same bags of cement.
 */
export async function approveRequisition(actor: SessionUser, mrId: string) {
  return db.transaction(async (tx) => {
    const mr = await tx.query.materialRequisitions.findFirst({
      where: eq(materialRequisitions.id, mrId),
      with: { lines: true },
    });
    if (!mr) throw new NotFoundError("Material requisition");
    if (mr.status !== "SUBMITTED") throw new ConflictError(`Cannot approve an MR in status ${mr.status}.`);

    assertCanApproveMr(actor.id, mr); // requester != approver

    for (const line of mr.lines) {
      await reserveStock(tx, line.itemId, mr.warehouseId, line.qtyRequested);
    }

    const [updated] = await tx
      .update(materialRequisitions)
      .set({ status: "APPROVED", approvedBy: actor.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(materialRequisitions.id, mrId))
      .returning();

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "MR_APPROVE",
      entity: "material_requisition",
      entityId: mrId,
      before: { status: mr.status },
      after: { status: "APPROVED" },
    });

    return updated;
  });
}

export async function rejectRequisition(actor: SessionUser, mrId: string, reason: string) {
  return db.transaction(async (tx) => {
    const mr = await tx.query.materialRequisitions.findFirst({ where: eq(materialRequisitions.id, mrId) });
    if (!mr) throw new NotFoundError("Material requisition");
    if (mr.status !== "SUBMITTED") throw new ConflictError(`Cannot reject an MR in status ${mr.status}.`);

    const [updated] = await tx
      .update(materialRequisitions)
      .set({ status: "REJECTED", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(materialRequisitions.id, mrId))
      .returning();

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "MR_REJECT",
      entity: "material_requisition",
      entityId: mrId,
      after: { status: "REJECTED", reason },
    });
    return updated;
  });
}

/* ----------------------------- issuance ----------------------------- */

export interface IssueLineInput {
  mrItemId: string;
  quantity: string;
}

export interface CreateIssuanceInput {
  mrId: string;
  receivedByName: string;
  lines: IssueLineInput[];
}

/**
 * Issue approved materials to site (Material Issuance Slip). For each line the
 * reservation is released and an ISSUE movement deducts stock, costed at the
 * warehouse's moving-average. Cannot issue more than was requested.
 */
export async function createAndPostIssuance(actor: SessionUser, input: CreateIssuanceInput) {
  if (input.lines.length === 0) throw new BusinessRuleError("An issuance needs at least one line.");

  return db.transaction(async (tx) => {
    const mr = await tx.query.materialRequisitions.findFirst({
      where: eq(materialRequisitions.id, input.mrId),
      with: { lines: true },
    });
    if (!mr) throw new NotFoundError("Material requisition");
    if (mr.status !== "APPROVED" && mr.status !== "PARTIALLY_ISSUED") {
      throw new ConflictError(`Cannot issue against an MR in status ${mr.status}.`);
    }

    const mrLineById = new Map(mr.lines.map((l) => [l.id, l]));
    const issueNumber = await nextDocumentNumber(tx, "ISSUANCE");

    const [issuance] = await tx
      .insert(issuances)
      .values({
        issueNumber,
        mrId: mr.id,
        warehouseId: mr.warehouseId,
        projectId: mr.projectId,
        status: "POSTED",
        receivedByName: input.receivedByName,
        issuedBy: actor.id,
        postedAt: new Date(),
      })
      .returning();

    for (const line of input.lines) {
      const mrLine = mrLineById.get(line.mrItemId);
      if (!mrLine) throw new BusinessRuleError(`MR line ${line.mrItemId} does not belong to this MR.`);

      const issueQty = Number(line.quantity);
      const remaining = Number(mrLine.qtyRequested) - Number(mrLine.qtyIssued);
      if (issueQty > remaining + 1e-9) {
        throw new BusinessRuleError(
          `Cannot issue ${issueQty}; only ${remaining} remaining on requisition line.`,
        );
      }

      await tx.insert(issuanceItems).values({
        issuanceId: issuance.id,
        mrItemId: mrLine.id,
        itemId: mrLine.itemId,
        quantity: line.quantity,
      });

      await releaseReservation(tx, mrLine.itemId, mr.warehouseId, line.quantity);

      await applyMovement(tx, {
        itemId: mrLine.itemId,
        warehouseId: mr.warehouseId,
        type: "ISSUE",
        quantity: line.quantity,
        projectId: mr.projectId,
        refType: "ISSUANCE",
        refId: issuance.id,
        refNumber: issueNumber,
        actorId: actor.id,
      });

      await tx
        .update(materialRequisitionItems)
        .set({ qtyIssued: String(Number(mrLine.qtyIssued) + issueQty) })
        .where(eq(materialRequisitionItems.id, mrLine.id));
    }

    // Recompute MR status.
    const refreshed = await tx
      .select({ requested: materialRequisitionItems.qtyRequested, issued: materialRequisitionItems.qtyIssued })
      .from(materialRequisitionItems)
      .where(eq(materialRequisitionItems.mrId, mr.id));
    const fullyIssued = refreshed.every((l) => Number(l.issued) >= Number(l.requested) - 1e-9);

    await tx
      .update(materialRequisitions)
      .set({ status: fullyIssued ? "ISSUED" : "PARTIALLY_ISSUED", updatedAt: new Date() })
      .where(eq(materialRequisitions.id, mr.id));

    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ISSUANCE_POST",
      entity: "issuance",
      entityId: issuance.id,
      after: { issueNumber, mrNumber: mr.mrNumber },
    });

    return issuance;
  });
}

export async function listRequisitions(limit = 50) {
  return db.query.materialRequisitions.findMany({
    orderBy: [desc(materialRequisitions.createdAt)],
    limit,
    with: { project: true, warehouse: true, requester: { columns: { fullName: true } } },
  });
}

export async function getRequisition(id: string) {
  const mr = await db.query.materialRequisitions.findFirst({
    where: eq(materialRequisitions.id, id),
    with: { project: true, warehouse: true, lines: { with: { item: true } } },
  });
  if (!mr) throw new NotFoundError("Material requisition");
  return mr;
}
