import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  goodsReceipts,
  issuances,
  materialRequisitions,
  purchaseOrders,
  sales,
  stockAdjustments,
  stockMovements,
  transfers,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "./ledger";

/**
 * Hard-delete a user, but only one who never acted in the system. Anyone who
 * raised a document, moved stock or rang a sale is referenced by ON DELETE
 * RESTRICT foreign keys — removing them would orphan or corrupt those records, so
 * the answer there is the Active/Inactive toggle (which also frees their login).
 *
 * The administrator account can never be deleted, and no one can delete their own
 * account — both would risk locking everyone out with no recovery path.
 */
export async function deleteUser(actor: SessionUser, id: string): Promise<void> {
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new NotFoundError("User");

  if (target.role === "ADMIN") {
    throw new ForbiddenError("The administrator account cannot be deleted.");
  }
  if (target.id === actor.id) {
    throw new ForbiddenError("You cannot delete your own account.");
  }

  const [mv, po, grn, mr, iss, tr, adj, sale, att] = await Promise.all([
    db.$count(stockMovements, eq(stockMovements.createdBy, id)),
    db.$count(purchaseOrders, eq(purchaseOrders.createdBy, id)),
    db.$count(goodsReceipts, eq(goodsReceipts.createdBy, id)),
    db.$count(materialRequisitions, eq(materialRequisitions.requestedBy, id)),
    db.$count(issuances, eq(issuances.issuedBy, id)),
    db.$count(transfers, eq(transfers.createdBy, id)),
    db.$count(stockAdjustments, eq(stockAdjustments.createdBy, id)),
    db.$count(sales, eq(sales.createdBy, id)),
    db.$count(attachments, eq(attachments.uploadedBy, id)),
  ]);

  const used = mv + po + grn + mr + iss + tr + adj + sale + att;
  if (used > 0) {
    throw new ConflictError(
      "This user has activity in the system and cannot be deleted. Deactivate the account instead — that blocks their login while keeping the records they created.",
    );
  }

  // sessions cascade; audit_logs.actor_id is ON DELETE SET NULL, so the trail survives.
  await db.delete(users).where(eq(users.id, id));

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "USER_DELETE",
    entity: "user",
    entityId: id,
    before: { email: target.email, fullName: target.fullName, role: target.role },
  });
}
