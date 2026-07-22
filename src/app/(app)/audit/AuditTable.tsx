"use client";

import { Fragment, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatManila } from "@/lib/ph";

interface AuditRow {
  id: string;
  createdAt: Date;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      {value == null ? (
        <span className="text-xs text-muted">—</span>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface-2">
          <pre className="whitespace-pre-wrap break-words p-2 text-xs tabular">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filtered = rows.filter((r) => rowMatches([r.actorEmail, r.action, r.entity], query));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search actor, action, entity…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} entries
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th className="w-8" />
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Entity ID</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>No audit entries match your search.</EmptyRow>
            ) : (
              filtered.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <Tr onClick={() => toggle(r.id)}>
                      <Td muted className="text-xs">
                        <span
                          aria-hidden
                          className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          ›
                        </span>
                        <span className="sr-only">{isOpen ? "Hide details" : "Show details"}</span>
                      </Td>
                      <Td muted className="whitespace-nowrap text-xs">
                        {formatManila(r.createdAt)}
                      </Td>
                      <Td>{r.actorEmail ?? "system"}</Td>
                      <Td>
                        <StatusBadge value={r.action} tone="outline" />
                      </Td>
                      <Td muted>{r.entity}</Td>
                      <Td className="tabular text-xs text-muted">{r.entityId ?? "—"}</Td>
                    </Tr>
                    {isOpen && (
                      <tr className="border-t border-line bg-surface-2">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <JsonBlock label="Before" value={r.before} />
                            <JsonBlock label="After" value={r.after} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
