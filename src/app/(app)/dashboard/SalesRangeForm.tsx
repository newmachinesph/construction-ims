import { Button } from "@/components/ui/Button";

/**
 * Date-range + granularity filter, one row above the charts.
 *
 * A plain GET form: the range lives in the URL, so a view is shareable and
 * bookmarkable and the page stays a Server Component. No client JS needed.
 */
export function SalesRangeForm({
  from,
  to,
  granularity,
}: {
  from: string;
  to: string;
  granularity: "day" | "month";
}) {
  return (
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="granularity" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Group by
        </label>
        <select
          id="granularity"
          name="granularity"
          defaultValue={granularity}
          className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <option value="day">Daily</option>
          <option value="month">Monthly</option>
        </select>
      </div>
      <Button type="submit" size="sm" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
