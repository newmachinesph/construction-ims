"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { manilaToday, UOM_LABELS } from "@/lib/ph";

interface Option {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  sku: string;
  name: string;
  uom: string;
}

interface LineRow {
  key: string;
  itemId: string;
  qtyRequested: string;
}

function emptyLine(): LineRow {
  return { key: crypto.randomUUID(), itemId: "", qtyRequested: "" };
}

interface NewMrFormProps {
  projects: Option[];
  warehouses: Option[];
  items: ItemOption[];
}

export function NewMrForm({ projects, warehouses, items }: NewMrFormProps) {
  const router = useRouter();

  const [projectId, setProjectId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [neededDate, setNeededDate] = useState(manilaToday());
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectId || !warehouseId || !neededDate) {
      setError("Project, warehouse and needed date are required.");
      return;
    }

    const validLines = lines.filter((l) => l.itemId && Number(l.qtyRequested) > 0);
    if (validLines.length === 0) {
      setError("Add at least one line with an item and quantity.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/requisitions", {
      projectId,
      warehouseId,
      neededDate,
      purpose: purpose.trim() || undefined,
      lines: validLines.map((l) => ({ itemId: l.itemId, qtyRequested: l.qtyRequested })),
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/requisitions");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError>{error}</FormError>

      <section className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Project" htmlFor="projectId" required>
          <Select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Warehouse" htmlFor="warehouseId" required>
          <Select id="warehouseId" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Needed date" htmlFor="neededDate" required>
          <Input
            id="neededDate"
            type="date"
            value={neededDate}
            onChange={(e) => setNeededDate(e.target.value)}
            required
          />
        </Field>

        <Field label="Purpose" htmlFor="purpose" hint="Optional" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="size-3.5" />
            Add line
          </Button>
        </div>

        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty requested</Th>
              <Th />
            </THead>
            <TBody>
              {lines.length === 0 ? (
                <EmptyRow colSpan={3}>Add a line to get started.</EmptyRow>
              ) : (
                lines.map((line) => {
                  const item = items.find((i) => i.id === line.itemId);
                  return (
                    <Tr key={line.key}>
                      <Td className="min-w-48">
                        <Select value={line.itemId} onChange={(e) => updateLine(line.key, { itemId: e.target.value })}>
                          <option value="">Select item…</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.sku} — {i.name}
                            </option>
                          ))}
                        </Select>
                        {item ? (
                          <p className="mt-1 text-xs text-muted">
                            {UOM_LABELS[item.uom as keyof typeof UOM_LABELS] ?? item.uom}
                          </p>
                        ) : null}
                      </Td>
                      <Td numeric className="min-w-28">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.qtyRequested}
                          onChange={(e) => updateLine(line.key, { qtyRequested: e.target.value })}
                          className="text-right"
                        />
                      </Td>
                      <Td>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/requisitions")}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit requisition"}
        </Button>
      </div>
    </form>
  );
}
