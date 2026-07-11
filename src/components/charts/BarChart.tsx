"use client";

import { useState } from "react";
import { formatPHP } from "@/lib/ph";

export interface BarDatum {
  /** Axis label, e.g. "2026-07-11" or "2026-07". */
  label: string;
  value: number;
  /** Optional second line in the tooltip. */
  note?: string;
}

/**
 * Single-series vertical bar chart, inline SVG, no dependency.
 *
 * One series, so no legend and no categorical colour: the title names it and the
 * bars are plain ink. Marks have rounded data-ends anchored to the baseline, a
 * gap between bars, and a recessive baseline/gridline. Hover gives a tooltip.
 */
export function BarChart({
  data,
  height = 200,
  emptyMessage = "No data in this range.",
}: {
  data: BarDatum[];
  height?: number;
  emptyMessage?: string;
  // NOTE: no `formatValue` prop. This is a Client Component, and a function
  // cannot cross the server/client boundary — it imports the formatter instead.
}) {
  const formatValue = formatPHP;
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-card border border-line bg-surface py-16 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 0);
  const W = 1000; // viewBox units; the SVG scales to its container
  const H = height;
  const padTop = 16;
  const padBottom = 28;
  const plotH = H - padTop - padBottom;

  const slot = W / data.length;
  const gap = Math.min(slot * 0.3, 14); // >= 2px surface gap between fills
  // Cap the width so a range with one or two buckets shows a bar, not a slab.
  const barW = Math.min(Math.max(slot - gap, 2), 72);
  const r = Math.min(4, barW / 2); // 4px rounded data-end

  // Only label a readable number of ticks — never every bar on a long range.
  const tickEvery = Math.ceil(data.length / 8);

  function barPath(x: number, y: number, w: number, h: number): string {
    if (h <= r) return `M${x},${y + h} h${w} v${-h} h${-w} z`;
    return [
      `M${x},${y + h}`,
      `V${y + r}`,
      `a${r},${r} 0 0 1 ${r},${-r}`,
      `h${w - 2 * r}`,
      `a${r},${r} 0 0 1 ${r},${r}`,
      `V${y + h}`,
      "z",
    ].join(" ");
  }

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative rounded-card border border-line bg-surface p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Bar chart, ${data.length} periods, peak ${formatValue(max)}`}
      >
        {/* Baseline — recessive */}
        <line
          x1={0}
          x2={W}
          y1={padTop + plotH}
          y2={padTop + plotH}
          stroke="var(--color-line-strong)"
          strokeWidth={2}
        />

        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * plotH : 0;
          const x = i * slot + (slot - barW) / 2; // centred in its slot
          const y = padTop + plotH - h;
          const isHover = hover === i;
          return (
            <g key={d.label}>
              {/* Hit target is the full column, larger than the mark itself. */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <path
                d={barPath(x, y, barW, h)}
                fill="var(--color-ink)"
                opacity={hover === null || isHover ? 1 : 0.35}
                className="pointer-events-none transition-opacity"
              />
              {i % tickEvery === 0 ? (
                <text
                  x={i * slot + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="pointer-events-none"
                  fill="var(--color-muted)"
                  fontSize={11}
                >
                  {d.label.length > 7 ? d.label.slice(5) : d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {active ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-lg">
          <div className="tabular font-semibold text-ink">{formatValue(active.value)}</div>
          <div className="text-muted">{active.label}</div>
          {active.note ? <div className="text-muted">{active.note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
