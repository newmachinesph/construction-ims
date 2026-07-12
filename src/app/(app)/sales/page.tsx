import Link from "next/link";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listSales } from "@/lib/services/sales";
import { salesReport } from "@/lib/services/salesReport";
import { formatManila, formatPHP, manilaToday } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { SalesReportSection } from "./SalesReportSection";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Default range is TODAY — the common case is the end-of-day close, where the
 * day's takings are split into the COGS account and the Net account.
 */
function parseRange(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = manilaToday();
  const rawFrom = one(sp.from);
  const rawTo = one(sp.to);

  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today;
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("sale:read");
  const [canSell, canCost, sp] = await Promise.all([
    can("sale:create"),
    can("report:cost"),
    searchParams,
  ]);

  const { from, to } = parseRange(sp);
  const [rows, report] = await Promise.all([listSales(), salesReport(from, to, "day")]);

  return (
    <>
      <PageHeader title="Sales" description="Counter sales, and the day's COGS / Net breakdown.">
        {canSell ? (
          <Link href="/pos">
            <Button size="sm">New sale</Button>
          </Link>
        ) : null}
      </PageHeader>

      {/* Date range — a plain GET form, so the view is shareable and the page stays a
          Server Component. Defaults to today. */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            From
          </label>
          <input
            type="date"
            id="from"
            name="from"
            defaultValue={from}
            className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            To
          </label>
          <input
            type="date"
            id="to"
            name="to"
            defaultValue={to}
            className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        <p className="ml-auto text-xs text-muted">
          Posted sales only — a voided invoice is not revenue.
        </p>
      </form>

      <SalesReportSection report={report} canCost={canCost} from={from} to={to} />

      {/* ------------------------------ invoice list ------------------------------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Recent invoices
        </h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Invoice</Th>
              <Th>When</Th>
              <Th>Customer</Th>
              <Th>Warehouse</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th numeric>Total</Th>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7}>No sales yet.</EmptyRow>
              ) : (
                rows.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link
                        href={`/sales/${s.id}`}
                        className="tabular text-ink underline-offset-4 hover:underline"
                      >
                        {s.siNumber}
                      </Link>
                    </Td>
                    <Td muted className="whitespace-nowrap text-xs">
                      {formatManila(s.createdAt)}
                    </Td>
                    <Td>{s.customer?.name ?? s.customerName ?? "Walk-in"}</Td>
                    <Td muted>{s.warehouse?.name}</Td>
                    <Td muted>{s.paymentMethod.replace("_", " ")}</Td>
                    <Td>
                      <StatusBadge value={s.status} />
                    </Td>
                    <Td numeric>{formatPHP(s.total)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>
    </>
  );
}
