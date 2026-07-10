/** Join class names, dropping falsy values. No dependency needed. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** True when the query (lowercased) is empty or matches any of the given values. */
export function rowMatches(values: Array<unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => v != null && String(v).toLowerCase().includes(q));
}
