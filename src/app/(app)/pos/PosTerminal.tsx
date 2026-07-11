"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";
import { computeTotals, formatPHP, formatQty, manilaToday, UOM_LABELS } from "@/lib/ph";
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

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

/**
 * Counter register. Totals are computed client-side with the same pure `ph.ts`
 * helpers the server uses, so the cashier sees exactly what will be posted —
 * but the server recomputes them on submit and never trusts these numbers.
 */
export function PosTerminal({
  warehouses,
  customers,
}: {
  warehouses: WarehouseOption[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTin, setCustomerTin] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [amountTendered, setAmountTendered] = useState("");
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

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          unitPrice: l.unitPrice || "0",
          quantity: l.quantity || "0",
          vatClass: l.vatClass,
        })),
        { withholdEwt: false },
      ),
    [lines],
  );

  const change =
    paymentMethod === "CASH" && amountTendered
      ? Number(amountTendered) - Number(totals.total)
      : null;

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

  async function submit() {
    setError(null);

    if (lines.length === 0) {
      setError("Add at least one item to the sale.");
      return;
    }
    if (overSold.length > 0) {
      setError(`Not enough stock for: ${overSold.map((l) => l.sku).join(", ")}.`);
      return;
    }
    if (paymentMethod === "CASH" && amountTendered && Number(amountTendered) < Number(totals.total)) {
      setError("Cash tendered is less than the total due.");
      return;
    }

    setSubmitting(true);
    const result = await api.post<{ id: string; siNumber: string }>("/api/sales", {
      warehouseId,
      customerId: customerId || null,
      customerName: customerId ? null : customerName.trim() || null,
      customerTin: customerId ? null : customerTin.trim() || null,
      saleDate: manilaToday(),
      paymentMethod,
      amountTendered: paymentMethod === "CASH" && amountTendered ? amountTendered : null,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatClass: l.vatClass,
      })),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Sale ${result.data.siNumber} posted.`);
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
                        {formatPHP(s.sellingPrice)} / {uomLabel(s.uom)} · {formatQty(s.qtyOnHand)} on
                        hand
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

        <dl className="flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
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
          <div className="flex justify-between">
            <dt className="text-muted">Output VAT (12%)</dt>
            <dd className="tabular text-ink-soft">{formatPHP(totals.vatAmount)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt className="text-ink">Total due</dt>
            <dd className="tabular text-ink">{formatPHP(totals.total)}</dd>
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

        <Button onClick={submit} disabled={submitting || lines.length === 0}>
          {submitting ? "Posting sale…" : "Complete sale"}
        </Button>
      </section>
    </div>
  );
}
