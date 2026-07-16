"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";
import { computeTotals, formatPHP, formatQty, manilaToday } from "@/lib/ph";
import type { VatClass } from "@/db/schema";

interface WarehouseOption {
  id: string;
  name: string;
}
interface CustomerOption {
  id: string;
  name: string;
}

interface Sellable {
  id: string;
  sku: string;
  name: string;
  uom: string;
  vatClass: VatClass;
  sellingPrice: string;
  qtyOnHand: string;
}

interface CartLine {
  key: string;
  itemId: string;
  sku: string;
  name: string;
  uom: string;
  vatClass: VatClass;
  quantity: string;
  unitPrice: string;
  qtyOnHand: string;
}

const PAYMENT_METHODS = ["CASH", "GCASH", "BANK_TRANSFER", "CHECK", "CARD"] as const;

/**
 * Counter register. Totals are computed client-side with the same pure `ph.ts`
 * helpers the server uses, so the cashier sees exactly what will be posted —
 * but the server recomputes them on submit and never trusts these numbers.
 */
export function PosTerminal({
  warehouses,
  customers,
  vatRate,
  uomLabels,
}: {
  warehouses: WarehouseOption[];
  customers: CustomerOption[];
  /** Output-VAT rate from company settings (0 when not VAT-registered). */
  vatRate: number;
  /** uom code -> label, so custom units display their name, not their code. */
  uomLabels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const uomLabel = (code: string) => uomLabels[code] ?? code;

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTin, setCustomerTin] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [saleDate, setSaleDate] = useState(manilaToday());
  const [deliveryFee, setDeliveryFee] = useState("");
  const [discountMode, setDiscountMode] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [discountValue, setDiscountValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: sellable = [], isLoading } = useQuery({
    queryKey: ["sellable", warehouseId],
    queryFn: async (): Promise<Sellable[]> => {
      const res = await fetch(`/api/sales/sellable?warehouseId=${warehouseId}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Failed to load items.");
      return body.data as Sellable[];
    },
    enabled: Boolean(warehouseId),
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sellable
      .filter((s) => s.sku.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, sellable]);

  const hasDiscount = Number(discountValue) > 0;

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          unitPrice: l.unitPrice || "0",
          quantity: l.quantity || "0",
          vatClass: l.vatClass,
        })),
        {
          withholdEwt: false,
          vatRate,
          discount: hasDiscount ? { type: discountMode, value: discountValue } : undefined,
        },
      ),
    [lines, vatRate, hasDiscount, discountMode, discountValue],
  );

  // Delivery rides on top of the goods total, after VAT — matches the server.
  const deliveryNum = Number(deliveryFee) > 0 ? Number(deliveryFee) : 0;
  const totalDue = Number(totals.total) + deliveryNum;

  const change =
    paymentMethod === "CASH" && amountTendered ? Number(amountTendered) - totalDue : null;

  function addItem(s: Sellable) {
    setQuery("");
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === s.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === s.id ? { ...l, quantity: String(Number(l.quantity) + 1) } : l,
        );
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          itemId: s.id,
          sku: s.sku,
          name: s.name,
          uom: s.uom,
          vatClass: s.vatClass,
          quantity: "1",
          unitPrice: s.sellingPrice,
          qtyOnHand: s.qtyOnHand,
        },
      ];
    });
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const overSold = lines.filter((l) => Number(l.quantity) > Number(l.qtyOnHand));
  const unpriced = lines.filter((l) => !(Number(l.unitPrice) > 0));
  // Number("") and Number("0") are both 0, so a blank/zero qty passes the overSold
  // check (0 > onHand is false) and would leave the button enabled.
  const zeroQty = lines.filter((l) => !(Number(l.quantity) > 0));

  async function submit() {
    setError(null);

    if (lines.length === 0) {
      setError("Add at least one item to the sale.");
      return;
    }
    if (zeroQty.length > 0) {
      setError(`Enter a quantity above zero for: ${zeroQty.map((l) => l.sku).join(", ")}.`);
      return;
    }
    if (unpriced.length > 0) {
      setError(
        `No selling price set for: ${unpriced.map((l) => l.sku).join(", ")}. Type a price, or set it on the item.`,
      );
      return;
    }
    if (overSold.length > 0) {
      setError(`Not enough stock for: ${overSold.map((l) => l.sku).join(", ")}.`);
      return;
    }
    if (paymentMethod === "CASH" && amountTendered && Number(amountTendered) < totalDue) {
      setError("Cash tendered is less than the total due.");
      return;
    }

    setSubmitting(true);
    const result = await api.post<{ id: string; siNumber: string }>("/api/sales", {
      warehouseId,
      customerId: customerId || null,
      customerName: customerId ? null : customerName.trim() || null,
      customerTin: customerId ? null : customerTin.trim() || null,
      saleDate: saleDate || manilaToday(),
      paymentMethod,
      amountTendered: paymentMethod === "CASH" && amountTendered ? amountTendered : null,
      discountType: hasDiscount ? discountMode : null,
      discountValue: hasDiscount ? discountValue : null,
      deliveryFee: deliveryNum > 0 ? deliveryFee : null,
      // No vatClass: the server reads it from the item master.
      lines: lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Sale ${result.data.siNumber} posted.`);
    // Stock just moved. Without this the 30s staleTime would serve pre-sale
    // qtyOnHand to the next customer at this register — showing sold-out goods
    // as available until the server rejects them at submit.
    await queryClient.invalidateQueries({ queryKey: ["sellable", warehouseId] });
    router.push(`/sales/${result.data.id}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* ---------------------------- cart ---------------------------- */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Warehouse" htmlFor="pos-warehouse" required>
            <Select
              id="pos-warehouse"
              value={warehouseId}
              onChange={(e) => {
                // Stock is per-warehouse, so the cart cannot survive the switch.
                // Say so rather than silently wiping a half-rung sale.
                if (lines.length > 0) toast.info("Cart cleared — warehouse changed.");
                setWarehouseId(e.target.value);
                setLines([]);
              }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Find item" htmlFor="pos-search" hint="Search by SKU or name, then press Add.">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                id="pos-search"
                className="pl-8"
                placeholder="e.g. cement, CEM-40"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
          </Field>
        </div>

        {query.trim() ? (
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-muted">Loading items…</p>
            ) : matches.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No sellable item matches “{query}”.</p>
            ) : (
              <ul>
                {matches.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-ink">{s.name}</span>{" "}
                      <span className="tabular text-xs text-muted">{s.sku}</span>
                      <div className="text-xs text-muted">
                        {Number(s.sellingPrice) > 0 ? (
                          formatPHP(s.sellingPrice)
                        ) : (
                          <span className="text-alert">No price set</span>
                        )}{" "}
                        / {uomLabel(s.uom)} · {formatQty(s.qtyOnHand)} on hand
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => addItem(s)}>
                      <Plus className="size-4" /> Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="px-3 py-2.5 text-left">Item</th>
                <th scope="col" className="px-3 py-2.5 text-right">Qty</th>
                <th scope="col" className="px-3 py-2.5 text-right">Unit price</th>
                <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                <th scope="col" className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                    Cart is empty. Search for an item above.
                  </td>
                </tr>
              ) : (
                lines.map((l) => {
                  const short = Number(l.quantity) > Number(l.qtyOnHand);
                  const noPrice = !(Number(l.unitPrice) > 0);
                  return (
                    <tr key={l.key} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <span className="text-ink">{l.name}</span>{" "}
                        <span className="tabular text-xs text-muted">{l.sku}</span>
                        {short ? (
                          <div className="text-xs text-alert">
                            Only {formatQty(l.qtyOnHand)} {uomLabel(l.uom)} on hand
                          </div>
                        ) : null}
                        {noPrice ? (
                          <div className="text-xs text-alert">No selling price set — enter one.</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          aria-label={`Quantity for ${l.name}`}
                          type="number"
                          min="0.001"
                          step="0.001"
                          className="w-24 text-right"
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          aria-label={`Unit price for ${l.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-28 text-right"
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                        />
                      </td>
                      <td className="tabular px-3 py-2 text-right text-ink">
                        {formatPHP(Number(l.quantity || 0) * Number(l.unitPrice || 0))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${l.name}`}
                          onClick={() => removeLine(l.key)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------- tender --------------------------- */}
      <section className="flex h-fit flex-col gap-4 rounded-card border border-line bg-surface p-5 lg:sticky lg:top-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Payment</h2>

        <FormError>{error}</FormError>

        <Field label="Customer" htmlFor="pos-customer" hint="Leave blank for a walk-in buyer.">
          <Select id="pos-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {!customerId ? (
          <>
            <Field
              label="Buyer name"
              htmlFor="pos-buyer"
              hint="BIR requires the buyer's name on sales of PHP 1,000 and above."
            >
              <Input
                id="pos-buyer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in customer"
              />
            </Field>
            <Field label="Buyer TIN" htmlFor="pos-tin">
              <Input
                id="pos-tin"
                value={customerTin}
                onChange={(e) => setCustomerTin(e.target.value)}
                placeholder="000-000-000"
              />
            </Field>
          </>
        ) : null}

        <Field label="Sale date" htmlFor="pos-date">
          <Input
            id="pos-date"
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </Field>

        <Field label="Delivery fee" htmlFor="pos-delivery" hint="Added on top, after VAT.">
          <Input
            id="pos-delivery"
            type="number"
            min="0"
            step="0.01"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Discount" htmlFor="pos-discount" hint="Taken off before VAT.">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-line-strong">
              {(["AMOUNT", "PERCENT"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDiscountMode(m)}
                  aria-pressed={discountMode === m}
                  aria-label={m === "AMOUNT" ? "Peso discount" : "Percent discount"}
                  className={`h-10 w-10 text-sm font-medium transition-colors ${
                    discountMode === m ? "bg-ink text-paper" : "bg-surface text-muted hover:bg-surface-2"
                  }`}
                >
                  {m === "AMOUNT" ? "₱" : "%"}
                </button>
              ))}
            </div>
            <Input
              id="pos-discount"
              type="number"
              min="0"
              step={discountMode === "PERCENT" ? "0.1" : "0.01"}
              max={discountMode === "PERCENT" ? "100" : undefined}
              className="flex-1"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountMode === "PERCENT" ? "0" : "0.00"}
            />
          </div>
        </Field>

        <dl className="flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          {Number(totals.discount) > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular text-ink-soft">{formatPHP(totals.subtotalBeforeDiscount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">
                  Discount{discountMode === "PERCENT" ? ` (${discountValue}%)` : ""}
                </dt>
                <dd className="tabular text-alert">−{formatPHP(totals.discount)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">VATable sales</dt>
            <dd className="tabular text-ink-soft">{formatPHP(totals.vatableSales)}</dd>
          </div>
          {Number(totals.zeroRatedSales) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Zero-rated</dt>
              <dd className="tabular text-ink-soft">{formatPHP(totals.zeroRatedSales)}</dd>
            </div>
          ) : null}
          {Number(totals.exemptSales) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">VAT-exempt</dt>
              <dd className="tabular text-ink-soft">{formatPHP(totals.exemptSales)}</dd>
            </div>
          ) : null}
          {vatRate > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Output VAT ({+(vatRate * 100).toFixed(2)}%)</dt>
              <dd className="tabular text-ink-soft">{formatPHP(totals.vatAmount)}</dd>
            </div>
          ) : (
            <div className="flex justify-between">
              <dt className="text-muted">VAT</dt>
              <dd className="text-xs text-muted">Not VAT-registered</dd>
            </div>
          )}
          {deliveryNum > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Delivery fee</dt>
              <dd className="tabular text-ink-soft">{formatPHP(deliveryFee)}</dd>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt className="text-ink">Total due</dt>
            <dd className="tabular text-ink">{formatPHP(totalDue)}</dd>
          </div>
        </dl>

        <Field label="Payment method" htmlFor="pos-method" required>
          <Select
            id="pos-method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>

        {paymentMethod === "CASH" ? (
          <Field label="Cash tendered (PHP)" htmlFor="pos-tendered">
            <Input
              id="pos-tendered"
              type="number"
              min="0"
              step="0.01"
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
            />
          </Field>
        ) : null}

        {change !== null && amountTendered ? (
          <div className="flex justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Change</span>
            <span className={`tabular font-semibold ${change < 0 ? "text-alert" : "text-ink"}`}>
              {formatPHP(change)}
            </span>
          </div>
        ) : null}

        <Button
          onClick={submit}
          disabled={
            submitting ||
            lines.length === 0 ||
            unpriced.length > 0 ||
            overSold.length > 0 ||
            zeroQty.length > 0
          }
        >
          {submitting ? "Posting sale…" : "Complete sale"}
        </Button>
      </section>
    </div>
  );
}
