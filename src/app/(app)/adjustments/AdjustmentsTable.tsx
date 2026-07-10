"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatManila } from "@/lib/ph";
import { ApproveAdjustmentButton } from "./ApproveAdjustmentButton";

const ALERT_REASONS = new Set(["PILFERAGE", "DAMAGE", "SPOILAGE"]);

interface AdjustmentRow {
  id: string;
  adjustmentNumber: string;
  reason: string;
  status: string;
  remarks: string | null;
  createdAt: Date;
  warehouse: { name: string };
}

export function AdjustmentsTable({
  adjustments,
  canApprove,
}: {
  adjustments: AdjustmentRow[];
  canApprove: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = adjustments.filter((a) => rowMatches([a.adjustmentNumber, a.warehouse.name, a.reason], query));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Adjustments</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search adjustment # or warehouse…" />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <Th>Adj #</Th>
            <Th>Warehouse</Th>
            <Th>Reason</Th>
            <Th>Status</Th>
            <Th>Created</Th>
            <Th />
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>
                {adjustments.length === 0 ? "No adjustments yet." : "No adjustments match your search."}
              </EmptyRow>
            ) : (
              filtered.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium">
                    <Link
                      href={`/adjustments/${a.id}`}
                      className="text-ink-soft hover:text-ink hover:underline"
                    >
                      {a.adjustmentNumber}
                    </Link>
                  </Td>
                  <Td muted>{a.warehouse.name}</Td>
                  <Td>
                    <StatusBadge value={a.reason} tone={ALERT_REASONS.has(a.reason) ? "alert" : "outline"} />
                  </Td>
                  <Td>
                    <StatusBadge value={a.status} />
                  </Td>
                  <Td muted>{formatManila(a.createdAt)}</Td>
                  <Td>
                    {a.status === "DRAFT" && canApprove ? <ApproveAdjustmentButton id={a.id} /> : null}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
