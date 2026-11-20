// Small, dependency-free charts. Single series use one hue (brand); text stays
// in ink tokens; every mark has a hover tooltip and the data is readable as text.

export interface BarDatum {
  label: string;
  value: number;
  display: string;
  detail?: string;
  href?: string;
}

/** Horizontal bars: magnitude by category. */
export function BarList({ data, emptyText = "No data yet." }: { data: BarDatum[]; emptyText?: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || max === 0) return <p className="py-6 text-center text-ink-muted">{emptyText}</p>;
  return (
    <ul className="space-y-0.5">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const tip = `${d.label}: ${d.display}${d.detail ? ` · ${d.detail}` : ""}`;
        return (
          <li key={d.label} title={tip} className="group grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 rounded px-1 py-1.5 hover:bg-canvas">
            <span className="truncate text-xs text-ink-muted">{d.label}</span>
            <span className="relative h-3" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-brand transition-[filter] group-hover:brightness-90" style={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%` }} />
            </span>
            <span className="text-right text-xs font-semibold text-ink tabular-nums">{d.display}</span>
            <span className="sr-only">{tip}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical columns: change over time (e.g. months). */
export function ColumnChart({ data, emptyText = "No data yet." }: { data: BarDatum[]; emptyText?: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || max === 0) return <p className="py-6 text-center text-ink-muted">{emptyText}</p>;
  return (
    <div>
      <div className="relative flex h-44 items-end gap-[2px] border-b border-line-strong" role="list">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <span key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }} aria-hidden="true" />
        ))}
        {data.map((d) => (
          <div key={d.label} role="listitem" title={`${d.label}: ${d.display}${d.detail ? ` · ${d.detail}` : ""}`} className="group relative flex h-full flex-1 items-end justify-center">
            <span
              className="relative w-full max-w-10 rounded-t-[4px] bg-brand transition-[filter] group-hover:brightness-90"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-card bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">
              {d.label}: {d.display}
            </span>
            <span className="sr-only">
              {d.label}: {d.display}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center text-[11px] text-ink-muted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Two-dimensional counts as a table with single-hue shading (darker = more). */
export function HeatTable({
  rows,
  columns,
  value,
  caption,
}: {
  rows: readonly string[];
  columns: readonly string[];
  value: (row: string, col: string) => number;
  caption: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => columns.map((c) => value(r, c))));
  return (
    <table className="w-full border-separate border-spacing-[2px] text-center text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="text-left font-normal text-ink-muted"><span className="sr-only">Status</span></th>
          {columns.map((c) => (
            <th key={c} scope="col" className="pb-1 font-semibold text-ink-muted">{c}</th>
          ))}
          <th scope="col" className="pb-1 font-semibold text-ink-muted">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const total = columns.reduce((s, c) => s + value(r, c), 0);
          return (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left font-normal text-ink-muted">{r}</th>
              {columns.map((c) => {
                const v = value(r, c);
                const t = v / max;
                return (
                  <td
                    key={c}
                    title={`${r} · ${c}: ${v}`}
                    className={`rounded-[4px] py-2 font-semibold tabular-nums ${t > 0.55 ? "text-white" : "text-ink"}`}
                    style={{ background: v ? `color-mix(in oklab, var(--color-brand) ${Math.round(15 + t * 85)}%, var(--color-surface))` : "var(--color-surface-alt)" }}
                  >
                    {v || ""}
                  </td>
                );
              })}
              <td className="font-semibold tabular-nums">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** KPI tile: one headline number. */
export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>}
    </div>
  );
}
