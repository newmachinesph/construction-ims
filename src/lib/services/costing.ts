import { fromCentavos, toCentavos } from "@/lib/ph";
import type { MovementType } from "@/db/schema";

/**
 * Pure inventory-costing math. No server-only imports, so it is unit-testable
 * in a plain Node environment. `ledger.ts` re-exports these.
 */

const INBOUND: ReadonlySet<MovementType> = new Set<MovementType>([
  "RECEIPT",
  "TRANSFER_IN",
  "RETURN_FROM_SITE",
]);

const OUTBOUND: ReadonlySet<MovementType> = new Set<MovementType>([
  "ISSUE",
  "TRANSFER_OUT",
  "RETURN_TO_SUPPLIER",
]);

/** ADJUSTMENT carries its own sign; every other type is derived from direction. */
export function signedQuantity(type: MovementType, quantity: string): number {
  const n = Number(quantity);
  if (type === "ADJUSTMENT") return n;
  if (INBOUND.has(type)) return Math.abs(n);
  if (OUTBOUND.has(type)) return -Math.abs(n);
  throw new Error(`Unhandled movement type: ${type}`);
}

/**
 * Moving-average cost. Only inbound movements move the average; issues are
 * costed at the prevailing average (PAS 2 / PFRS weighted-average). Returns a
 * 2-dp string.
 */
export function nextAverageCost(
  qtyOnHand: string,
  avgUnitCost: string,
  incomingQty: string,
  incomingUnitCost: string,
): string {
  const onHand = Number(qtyOnHand);
  const incoming = Number(incomingQty);
  const newQty = onHand + incoming;

  if (newQty <= 0) return avgUnitCost; // degenerate; keep the old average
  if (onHand <= 0) return fromCentavos(toCentavos(incomingUnitCost));

  const existingValue = onHand * toCentavos(avgUnitCost);
  const incomingValue = incoming * toCentavos(incomingUnitCost);
  return fromCentavos(Math.round((existingValue + incomingValue) / newQty));
}
