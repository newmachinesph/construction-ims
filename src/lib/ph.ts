/**
 * Philippine tax, currency and unit rules.
 *
 * Everything here is pure and framework-free so it can be unit-tested and
 * reused on the client. Money is handled as integer centavos internally and
 * exposed as fixed-2 decimal strings — never as a JS float.
 *
 * Sources (see docs/PH-RESEARCH.md):
 *  - VAT 12%, threshold PHP 3,000,000  (NIRC as amended by TRAIN)
 *  - EWT 1% goods / 2% services, Top Withholding Agents (RR 11-2018)
 *  - RA 11976 "EOPT" + RR 7-2024: Sales Invoice is the sole primary document
 *  - Books of accounts retention: 5 years (EOPT)
 */

import type { VatClass } from "@/db/schema";

export const VAT_RATE = 0.12;
/** Gross annual sales above which VAT registration is mandatory. */
export const VAT_THRESHOLD_PHP = 3_000_000;
/** Percentage tax for non-VAT taxpayers. The 1% CREATE cut lapsed 2023-06-30. */
export const PERCENTAGE_TAX_RATE = 0.03;
export const EWT_RATE_GOODS = 0.01;
export const EWT_RATE_SERVICES = 0.02;
/** Books of accounts / invoice retention, in years. Reduced from 10 by EOPT. */
export const RECORD_RETENTION_YEARS = 5;
export const TIMEZONE = "Asia/Manila";

/* ------------------------------- money ------------------------------ */

/** Parse a decimal string ("1234.56") to integer centavos (123456). */
export function toCentavos(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`Not a number: ${value}`);
  // Round on the scaled value; 19.99 * 100 === 1998.9999... in IEEE-754.
  return Math.round(n * 100);
}

/** Render integer centavos as a fixed-2 decimal string, e.g. 123456 -> "1234.56". */
export function fromCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new TypeError("centavos must be an integer");
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Round a decimal-string money value to 2 places, half-up. */
export function roundMoney(value: string | number): string {
  return fromCentavos(toCentavos(value));
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPHP(value: string | number): string {
  return phpFormatter.format(Number(value));
}

const qtyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatQty(value: string | number): string {
  return qtyFormatter.format(Number(value));
}

/* -------------------------------- VAT ------------------------------- */

export interface TaxLine {
  /** VAT-exclusive unit price, decimal string. */
  unitPrice: string;
  /** Quantity, decimal string. */
  quantity: string;
  vatClass: VatClass;
}

export interface TaxTotals {
  /** Sum of all line amounts, VAT-exclusive, AFTER any discount. */
  subtotal: string;
  /** Sum of all line amounts, VAT-exclusive, BEFORE any discount. */
  subtotalBeforeDiscount: string;
  /** Resolved peso discount deducted from the net base (0 when none). */
  discount: string;
  vatableSales: string;
  zeroRatedSales: string;
  exemptSales: string;
  vatAmount: string;
  ewtAmount: string;
  /** subtotal + VAT — the gross invoice value. */
  total: string;
  /** total - EWT — cash actually remitted to the supplier. */
  netPayable: string;
}

/** How an invoice-level discount was entered: a peso amount or a percentage. */
export type DiscountInput = { type: "AMOUNT" | "PERCENT"; value: string | number };

/** Resolve a discount to centavos at the net level, clamped to [0, subtotal]. */
function resolveDiscountCents(discount: DiscountInput | undefined, subtotalCents: number): number {
  if (!discount) return 0;
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const cents =
    discount.type === "PERCENT"
      ? Math.round((subtotalCents * Math.min(Math.max(value, 0), 100)) / 100)
      : toCentavos(value);
  return Math.max(0, Math.min(cents, subtotalCents));
}

/**
 * Split a peso discount across the VAT-class bases in proportion to their share,
 * so VAT lands on the discounted VATABLE base. Largest-remainder allocation keeps
 * the parts summing to exactly the discount, and only non-zero bases take any.
 */
function allocateDiscount(discountCents: number, bases: readonly number[]): number[] {
  const total = bases.reduce((a, b) => a + b, 0);
  if (discountCents <= 0 || total <= 0) return bases.map(() => 0);

  const exact = bases.map((b) => (discountCents * b) / total);
  const alloc = exact.map(Math.floor);
  let remainder = discountCents - alloc.reduce((a, b) => a + b, 0);

  const order = bases
    .map((base, i) => ({ i, frac: exact[i] - alloc[i], base }))
    .filter((x) => x.base > 0)
    .sort((a, b) => b.frac - a.frac || b.base - a.base);

  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) alloc[order[k].i]++;
  if (remainder > 0 && order.length > 0) alloc[order[0].i] += remainder;
  return alloc;
}

/** Line amount, VAT-exclusive, rounded to centavos. */
export function lineTotal(line: Pick<TaxLine, "unitPrice" | "quantity">): string {
  const amount = Number(line.unitPrice) * Number(line.quantity);
  return roundMoney(amount);
}

/**
 * Compute BIR-shaped totals for a document.
 *
 * VAT is charged only on VATABLE lines. EWT, when we are a Top Withholding
 * Agent, is computed on the VAT-EXCLUSIVE base (BIR RMC 01-2018) — a common
 * bug is to withhold on the VAT-inclusive amount.
 */
export function computeTotals(
  lines: readonly TaxLine[],
  opts: { withholdEwt: boolean; ewtRate?: number; vatRate?: number; discount?: DiscountInput } = {
    withholdEwt: false,
  },
): TaxTotals {
  let vatable = 0;
  let zeroRated = 0;
  let exempt = 0;

  for (const line of lines) {
    const cents = toCentavos(lineTotal(line));
    if (line.vatClass === "VATABLE") vatable += cents;
    else if (line.vatClass === "ZERO_RATED") zeroRated += cents;
    else exempt += cents;
  }

  // Defaults to the statutory 12%. Sales pass the company's configured rate (0
  // when the company is not VAT-registered); purchases keep the default.
  const vatRate = opts.vatRate ?? VAT_RATE;

  const subtotalPre = vatable + zeroRated + exempt;

  // An invoice-level discount lowers the NET base before VAT (BIR-correct), split
  // across the VAT classes so output VAT drops with the VATABLE portion.
  const discount = resolveDiscountCents(opts.discount, subtotalPre);
  const [dV, dZ, dE] = allocateDiscount(discount, [vatable, zeroRated, exempt]);
  const vatablePost = vatable - dV;
  const zeroPost = zeroRated - dZ;
  const exemptPost = exempt - dE;

  const subtotal = subtotalPre - discount;
  const vat = Math.round(vatablePost * vatRate);
  const total = subtotal + vat;

  // EWT base is the VAT-exclusive amount across ALL classes, net of discount.
  const ewtRate = opts.ewtRate ?? EWT_RATE_GOODS;
  const ewt = opts.withholdEwt ? Math.round(subtotal * ewtRate) : 0;

  return {
    subtotal: fromCentavos(subtotal),
    subtotalBeforeDiscount: fromCentavos(subtotalPre),
    discount: fromCentavos(discount),
    vatableSales: fromCentavos(vatablePost),
    zeroRatedSales: fromCentavos(zeroPost),
    exemptSales: fromCentavos(exemptPost),
    vatAmount: fromCentavos(vat),
    ewtAmount: fromCentavos(ewt),
    total: fromCentavos(total),
    netPayable: fromCentavos(total - ewt),
  };
}

/** Back out the VAT from a VAT-inclusive price: 1120 -> { net: 1000, vat: 120 }. */
export function extractVat(vatInclusive: string | number): { net: string; vat: string } {
  const gross = toCentavos(vatInclusive);
  const net = Math.round(gross / (1 + VAT_RATE));
  return { net: fromCentavos(net), vat: fromCentavos(gross - net) };
}

/* -------------------------------- TIN ------------------------------- */

/** 9 digits, then an optional 3-5 digit branch code. "000" / "00000" = head office. */
const TIN_RE = /^(\d{3})-?(\d{3})-?(\d{3})(?:-?(\d{3,5}))?$/;

export function isValidTin(raw: string): boolean {
  return TIN_RE.test(raw.trim());
}

/** Normalise to 000-000-000 or 000-000-000-00000. Throws on invalid input. */
export function normalizeTin(raw: string): string {
  const m = TIN_RE.exec(raw.trim());
  if (!m) throw new Error(`Invalid TIN: ${raw}`);
  const [, a, b, c, branch] = m;
  return branch ? `${a}-${b}-${c}-${branch}` : `${a}-${b}-${c}`;
}

/* ------------------------------- units ------------------------------ */

export const UOM_LABELS = {
  BAG: "bag",
  PC: "pc",
  LENGTH: "length",
  KG: "kg",
  TON: "ton",
  CU_M: "cu.m",
  SQ_M: "sq.m",
  M: "m",
  LM: "lm",
  BD_FT: "bd.ft",
  SHEET: "sheet",
  ROLL: "roll",
  L: "L",
  GAL: "gal",
  PAIL: "pail",
  SET: "set",
  LOT: "lot",
} as const;

/** Standard commercial length of deformed bar and PVC pipe sold in PH. */
export const STANDARD_BAR_LENGTH_M = 6.0;
/** One bag of Portland cement. */
export const CEMENT_BAG_KG = 40;

/** Convert a stock quantity to kilograms, when the item has a mass per UoM. */
export function toKilograms(quantity: string | number, weightKgPerUom: string | null): number | null {
  if (weightKgPerUom === null) return null;
  return Number(quantity) * Number(weightKgPerUom);
}

/* ------------------------------- dates ------------------------------ */

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Asia/Manila as YYYY-MM-DD, regardless of server timezone. */
export function manilaToday(now: Date = new Date()): string {
  return manilaDate.format(now);
}

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatManila(value: Date | string): string {
  return manilaDateTime.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Typhoon / habagat season in the Philippines, roughly June-November.
 * Weather-sensitive items (cement, plywood, gypsum) carry extra buffer stock.
 */
export function isRainySeason(now: Date = new Date()): boolean {
  const month = Number(manilaToday(now).slice(5, 7));
  return month >= 6 && month <= 11;
}

/** Reorder point, inflated by 30% for weather-sensitive stock in rainy season. */
export function effectiveReorderPoint(
  reorderPoint: string | number,
  isWeatherSensitive: boolean,
  now: Date = new Date(),
): number {
  const base = Number(reorderPoint);
  return isWeatherSensitive && isRainySeason(now) ? base * 1.3 : base;
}
