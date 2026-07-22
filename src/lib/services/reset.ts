import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  auditLogs,
  categories,
  customers,
  documentSeries,
  goodsReceiptItems,
  goodsReceipts,
  issuanceItems,
  issuances,
  items,
  materialRequisitionItems,
  materialRequisitions,
  projects,
  purchaseOrderItems,
  purchaseOrders,
  saleItems,
  sales,
  stockAdjustmentItems,
  stockAdjustments,
  stockLevels,
  stockMovements,
  suppliers,
  transferItems,
  transfers,
  uoms,
  warehouses,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { BusinessRuleError, ForbiddenError } from "@/lib/errors";
import { writeAudit } from "./ledger";

/**
 * Selective "factory reset". ALWAYS keeps user accounts, roles, sessions and
 * company settings — those are never touched. Everything else is opt-in.
 *
 * Because every transaction table has ON DELETE RESTRICT foreign keys to the
 * master data (items, suppliers, warehouses, …), wiping any master group requires
 * wiping transactions first. Deletes run children→parents inside one transaction,
 * so a failure rolls the whole thing back — never a half-erased database.
 */
export interface ResetScopes {
  /** Stock ledger + all documents (PO/GRN/MR/issuance/transfer/adjustment/sale) + attachments. */
  transactions: boolean;
  /** Items, categories and custom units (built-in units are kept). */
  catalog: boolean;
  /** Suppliers and customers. */
  partners: boolean;
  /** Warehouses and projects. */
  locations: boolean;
  /** The audit trail itself. */
  auditLog: boolean;
}

export async function resetData(actor: SessionUser, scopes: ResetScopes): Promise<void> {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Only an administrator can reset data.");

  const wipesMaster = scopes.catalog || scopes.partners || scopes.locations;
  if (wipesMaster && !scopes.transactions) {
    throw new BusinessRuleError(
      "Wiping the catalogue, suppliers/customers or warehouses/projects also requires wiping transactions — they are referenced by transaction records.",
    );
  }
  if (!scopes.transactions && !scopes.auditLog && !wipesMaster) {
    throw new BusinessRuleError("Select at least one thing to reset.");
  }

  await db.transaction(async (tx) => {
    if (scopes.transactions) {
      // Children first, then their parents. Attachments carry document proof photos.
      await tx.delete(attachments);
      await tx.delete(stockMovements);
      await tx.delete(saleItems);
      await tx.delete(sales);
      await tx.delete(goodsReceiptItems);
      await tx.delete(goodsReceipts);
      await tx.delete(purchaseOrderItems);
      await tx.delete(purchaseOrders);
      await tx.delete(issuanceItems);
      await tx.delete(issuances);
      await tx.delete(materialRequisitionItems);
      await tx.delete(materialRequisitions);
      await tx.delete(transferItems);
      await tx.delete(transfers);
      await tx.delete(stockAdjustmentItems);
      await tx.delete(stockAdjustments);
      await tx.delete(stockLevels);
      // BIR serials restart from 1.
      await tx.update(documentSeries).set({ nextNumber: 1 });
    }
    if (scopes.catalog) {
      await tx.delete(items);
      await tx.delete(categories);
      await tx.delete(uoms).where(eq(uoms.isSystem, false)); // keep the built-in units
    }
    if (scopes.partners) {
      await tx.delete(suppliers);
      await tx.delete(customers);
    }
    if (scopes.locations) {
      await tx.delete(warehouses);
      await tx.delete(projects);
    }
    if (scopes.auditLog) {
      await tx.delete(auditLogs);
    }
  });

  // Recorded AFTER the wipe, so the reset itself is logged even when the audit
  // log was one of the things cleared.
  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DATA_RESET",
    entity: "system",
    after: { scopes },
  });
}
