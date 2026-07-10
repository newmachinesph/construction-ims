/**
 * Minimal RFC 4180 CSV serializer. Pure and framework-free so it runs on both
 * server and client and stays unit-testable. No dependency — a spreadsheet
 * export does not warrant a library.
 */

export interface CsvColumn<T> {
  key: keyof T & string;
  label: string;
}

/** Escape one field: wrap in quotes when it contains a comma, quote, or newline. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialize rows to a CSV string with a header row. A leading BOM makes Excel
 * open UTF-8 (peso sign, ñ) correctly.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(","));
  return "﻿" + [header, ...body].join("\r\n");
}

// ponytail: runnable self-check. `npx tsx src/lib/csv.ts` fails loudly if broken.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("/lib/csv.ts")) {
  const out = toCsv(
    [{ a: "he,llo", b: 'sa"y', c: "one\ntwo" }],
    [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
      { key: "c", label: "C" },
    ],
  );
  const expected = '﻿A,B,C\r\n"he,llo","sa""y","one\ntwo"';
  if (out !== expected) throw new Error(`toCsv broken:\n${JSON.stringify(out)}`);
  console.log("csv.ts self-check ok");
}
