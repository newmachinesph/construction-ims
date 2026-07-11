import { formatPHP } from "@/lib/ph";

/**
 * Ranked horizontal bars — a category breakdown.
 *
 * Identity comes from the DIRECT LABEL on every row, never from colour: this app
 * is monochrome, so a categorical hue scale does not exist and encoding identity
 * by shade would be unreadable (and colour-alone anyway). Bars are plain ink,
 * sorted by magnitude, so the ranking is the message.
 *
 * Server-safe: no hooks, no interaction needed — each row is already labelled and
 * valued, so a tooltip would only repeat what is on screen.
 */
export function RankedBars({
  data,
  emptyMessage = "No sales in this range.",
}: {
  data: { name: string; value: number; note?: string }[];
  emptyMessage?: string;
}) {
  const formatValue = formatPHP;
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-card border border-line bg-surface py-16 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      {data.map((d) => (
        <div key={d.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-ink">{d.name}</span>
            <span className="tabular shrink-0 text-ink-soft">
              {formatValue(d.value)}
              {d.note ? <span className="ml-1.5 text-muted">{d.note}</span> : null}
            </span>
          </div>
          {/* Track + fill. Rounded data-end, 6px tall — thin marks. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: max > 0 ? `${Math.max((d.value / max) * 100, 1)}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
