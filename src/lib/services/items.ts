import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  goodsReceiptItems,
  issuanceItems,
  items,
  materialRequisitionItems,
  purchaseOrderItems,
  saleItems,
  stockAdjustmentItems,
  stockLevels,
  stockMovements,
  transferItems,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "./ledger";

/**
 * Hard-delete an item, but only when it was never actually used. A mistakenly-added
 * or never-stocked SKU can go; anything that appears in the stock ledger, a sale, or
 * a procurement/requisition/transfer/adjustment document cannot — deleting it would
 * corrupt those records (every item FK is ON DELETE RESTRICT by design). For those,
 * the answer is the Active/Inactive toggle, which hides the item without losing history.
 */
export async function deleteItem(actor: SessionUser, id: string): Promise<void> {
  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) throw new NotFoundError("Item");

  const [movements, poLines, grnLines, mrLines, issLines, trLines, adjLines, saleLines, stock] =
    await Promise.all([
      db.$count(stockMovements, eq(stockMovements.itemId, id)),
      db.$count(purchaseOrderItems, eq(purchaseOrderItems.itemId, id)),
      db.$count(goodsReceiptItems, eq(goodsReceiptItems.itemId, id)),
      db.$count(materialRequisitionItems, eq(materialRequisitionItems.itemId, id)),
      db.$count(issuanceItems, eq(issuanceItems.itemId, id)),
      db.$count(transferItems, eq(transferItems.itemId, id)),
      db.$count(stockAdjustmentItems, eq(stockAdjustmentItems.itemId, id)),
      db.$count(saleItems, eq(saleItems.itemId, id)),
      db.$count(
        stockLevels,
        and(eq(stockLevels.itemId, id), sql`(${stockLevels.qtyOnHand} <> 0 or ${stockLevels.qtyReserved} <> 0)`),
      ),
    ]);

  const used = movements + poLines + grnLines + mrLines + issLines + trLines + adjLines + saleLines + stock;
  if (used > 0) {
    throw new ConflictError(
      "This item is used in stock, sales or documents and cannot be deleted. Set it Inactive instead to hide it while keeping its history.",
    );
  }

  await db.transaction(async (tx) => {
    // Only zero-quantity stock rows can remain at this point — clear them and any
    // reference photos so the FK-restricted item row can be removed.
    await tx.delete(stockLevels).where(eq(stockLevels.itemId, id));
    await tx.delete(attachments).where(and(eq(attachments.entity, "item"), eq(attachments.entityId, id)));
    await tx.delete(items).where(eq(items.id, id));
  });

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ITEM_DELETE",
    entity: "item",
    entityId: id,
    before: { sku: item.sku, name: item.name },
  });
}
