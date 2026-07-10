"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatQty, UOM_LABELS } from "@/lib/ph";

interface MrLineOption {
  id: string;
  itemId: string;
  qtyRequested: string;
  qtyIssued: string;
  item: { sku: string; name: string; uom: string };
}

interface MrOption {
  id: string;
  mrNumber: string;
  project: { name: string };
  warehouse: { name: string };
  lines: MrLineOption[];
}

function remainingQty(line: MrLineOption): number {
  return Number(line.qtyRequested) - Number(line.qtyIssued);
}

function defaultQuantities(mr: MrOption): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of mr.lines) {
    const remaining = remainingQty(line);
    if (remaining > 0) map[line.id] = remaining.toFixed(3);
  }
  return map;
}

export function IssueForm({ mrs }: { mrs: MrOption[] }) {
  const router = useRouter();

  const [mrId, setMrId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [receivedByName, setReceivedByName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMr = mrs.find((m) => m.id === mrId) ?? null;

  function handleMrChange(id: string) {
    setMrId(id);
    setError(null);
    const mr = mrs.find((m) => m.id === id);
    setQuantities(mr ? defaultQuantities(mr) : {});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedMr || !receivedByName.trim()) {
      setError("Requisition and received-by name are required.");
      return;
    }

    const lines = selectedMr.lines
      .filter((l) => Number(quantities[l.id] ?? "0") > 0)
      .map((l) => ({ mrItemId: l.id, quantity: quantities[l.id] }));

    if (lines.length === 0) {
      setError("Enter a quantity for at least one line.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/issuances", { mrId: selectedMr.id, receivedByName: receivedByName.trim(), lines });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMrId("");
    setQuantities({});
    setReceivedByName("");
    router.refresh();
  }

  if (mrs.length === 0) {
    return (
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Issue to site</h2>
        <p className="mt-2 text-sm text-muted">No approved requisitions are awaiting issuance right now.</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Issue to site</h2>
      <FormError>{error}</FormError>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Requisition" htmlFor="mrId" required>
          <Select id="mrId" value={mrId} onChange={(e) => handleMrChange(e.target.value)} required>
            <option value="">Select requisition…</option>
            {mrs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.mrNumber} — {m.project.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Received by" htmlFor="receivedByName" required>
          <Input
            id="receivedByName"
            value={receivedByName}
            onChange={(e) => setReceivedByName(e.target.value)}
            placeholder="Foreman / gang leader name"
            required
          />
        </Field>
      </div>

      {selectedMr ? (
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Remaining</Th>
              <Th numeric>Quantity to issue</Th>
            </THead>
            <TBody>
              {selectedMr.lines.length === 0 ? (
                <EmptyRow colSpan={3}>This requisition has no lines.</EmptyRow>
              ) : (
                selectedMr.lines.map((line) => {
                  const remaining = remainingQty(line);
                  const uom = UOM_LABELS[line.item.uom as keyof typeof UOM_LABELS] ?? line.item.uom;
                  return (
                    <Tr key={line.id}>
                      <Td>
                        <span className="text-ink">{line.item.name}</span>{" "}
                        <span className="tabular text-xs text-muted">{line.item.sku}</span>
                      </Td>
                      <Td numeric muted>
                        {formatQty(remaining)} {uom}
                      </Td>
                      <Td numeric className="min-w-28">
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.001"
                          value={quantities[line.id] ?? ""}
                          onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                          disabled={remaining <= 0}
                          className="text-right"
                        />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !selectedMr}>
          {pending ? "Issuing…" : "Issue materials"}
        </Button>
      </div>
    </form>
  );
}
