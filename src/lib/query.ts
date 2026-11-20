/** Strips characters PostgREST treats as syntax inside or() filters. */
export function cleanSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,()*%\\:"]/g, " ").trim().slice(0, 100);
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Builds a query string from current params with overrides (null removes a key). */
export function withParams(base: string, sp: SearchParams, overrides: Record<string, string | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) p.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
