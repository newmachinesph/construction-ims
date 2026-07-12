/**
 * Minimal RFC 4180 CSV parser — the read side of `csv.ts`.
 *
 * A naive `line.split(",")` breaks the moment a field contains a comma, a quote,
 * or a newline ("Angle Bar 2\" x 2\"", "Cement, Portland"), which real supplier
 * spreadsheets are full of. This walks the text character by character instead.
 *
 * Pure and dependency-free, so it runs on the server and is unit-testable.
 */

/** Split raw CSV text into rows of raw cells. Handles quoted fields and CRLF. */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM — Excel writes one, and it would poison the first header.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'; // escaped quote ("")
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      // Consume CRLF as one break.
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }

  // Trailing cell/row (file not ending in a newline).
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop rows that are entirely empty — trailing blank lines are normal.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Parse CSV into objects keyed by the header row.
 *
 * Headers are normalised (lowercased, non-alphanumerics collapsed to `_`), so
 * "Reorder Point", "reorder point" and "reorder_point" all land on the same key
 * — a spreadsheet a human edited should not fail on capitalisation.
 */
export function parseCsvRecords(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = parseCsv(text);
  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = raw[0].map(normalizeHeader);
  const rows = raw.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });

  return { headers, rows };
}

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ponytail: runnable self-check. `npx tsx src/lib/csvParse.ts` fails loudly if broken.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("/lib/csvParse.ts")) {
  const text = 'SKU,Name,Qty\r\nCEM-01,"Cement, Portland",10\r\nSTL-01,"Angle Bar 2"" x 2""",5\r\n';
  const { headers, rows } = parseCsvRecords(text);
  const expectHeaders = ["sku", "name", "qty"];
  if (JSON.stringify(headers) !== JSON.stringify(expectHeaders)) {
    throw new Error(`headers broken: ${JSON.stringify(headers)}`);
  }
  if (rows[0].name !== "Cement, Portland") throw new Error(`comma-in-quotes broken: ${rows[0].name}`);
  if (rows[1].name !== 'Angle Bar 2" x 2"') throw new Error(`escaped quotes broken: ${rows[1].name}`);
  if (rows.length !== 2) throw new Error(`row count broken: ${rows.length}`);
  console.log("csvParse.ts self-check ok");
}
