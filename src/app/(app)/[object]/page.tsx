import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Columns3, List, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { getContext } from "@/lib/context";
import { getObject, lookupLabel, selectFor } from "@/lib/objects";
import { cleanSearch, param, withParams, type SearchParams } from "@/lib/query";
import { formatNumber } from "@/lib/format";
import { ObjectIcon } from "@/components/ObjectIcon";
import { FieldValue } from "@/components/FieldValue";
import { KanbanBoard, type KanbanCard } from "@/components/KanbanBoard";
import { EmptyState } from "@/components/Card";

const PAGE_SIZE = 25;

export async function generateMetadata({ params }: { params: Promise<{ object: string }> }): Promise<Metadata> {
  const def = getObject((await params).object);
  return { title: def?.plural ?? "Not found" };
}

export default async function ListViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ object: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const def = getObject((await params).object);
  if (!def) notFound();
  const sp = await searchParams;
  const { supabase, org, user } = await getContext();

  const base = `/${def.key}`;
  const q = cleanSearch(param(sp, "q"));
  const scope = param(sp, "scope") === "mine" ? "mine" : "all";
  const filterMeta = def.filterField ? def.fields[def.filterField] : undefined;
  const filterRaw = param(sp, "filter");
  const filter = filterRaw && filterMeta?.options?.includes(filterRaw) ? filterRaw : undefined;
  const view = def.kanban && param(sp, "view") === "kanban" ? "kanban" : "table";

  const sortParam = param(sp, "sort");
  const sortable = (c: string) => def.fields[c] && def.fields[c]!.type !== "lookup";
  const sort = sortParam && def.listColumns.includes(sortParam) && sortable(sortParam) ? sortParam : def.defaultSort.column;
  const ascending = sortParam ? param(sp, "dir") !== "desc" : def.defaultSort.ascending;
  const page = Math.max(0, Number(param(sp, "page") ?? 0) || 0);

  let query = supabase
    .from(def.key)
    .select(selectFor(def, def.listColumns), { count: "exact" })
    .eq("org_id", org.id);
  if (q) query = query.or(def.searchColumns.map((c) => `${c}.ilike.*${q}*`).join(","));
  if (filter && def.filterField) query = query.eq(def.filterField, filter);
  if (scope === "mine") query = query.eq("owner_id", user.id);

  if (view === "kanban") {
    query = query.order("close_date", { ascending: true }).limit(500);
  } else {
    query = query.order(sort, { ascending, nullsFirst: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columnLabel = (c: string) => (c === "last_name" ? "Name" : (def.fields[c]?.label ?? c));
  const viewName = `${scope === "mine" ? "My" : "All"} ${def.plural}`;

  return (
    <div className="card">
      {/* List header */}
      <div className="border-b border-line bg-surface-alt px-4 pt-3 pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <ObjectIcon name={def.icon} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">{def.plural}</p>
            <h1 className="text-lg leading-tight font-bold">{viewName}</h1>
          </div>
          <div className="flex gap-2">
            {def.kanban && (
              <div className="inline-flex rounded-card border border-line-strong" role="group" aria-label="Display as">
                <Link
                  href={withParams(base, sp, { view: null, page: null })}
                  aria-current={view === "table" ? "true" : undefined}
                  className={clsx("flex h-8 items-center px-2", view === "table" ? "bg-brand text-white" : "bg-surface text-brand hover:bg-canvas")}
                  aria-label="Table"
                  title="Table"
                >
                  <List className="size-4" />
                </Link>
                <Link
                  href={withParams(base, sp, { view: "kanban", page: null })}
                  aria-current={view === "kanban" ? "true" : undefined}
                  className={clsx("flex h-8 items-center border-l border-line-strong px-2", view === "kanban" ? "bg-brand text-white" : "bg-surface text-brand hover:bg-canvas")}
                  aria-label="Kanban"
                  title="Kanban"
                >
                  <Columns3 className="size-4" />
                </Link>
              </div>
            )}
            <Link href={`${base}/new`} className="btn btn-primary">
              <Plus className="size-4" /> New
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="mr-auto text-xs text-ink-muted">
            {formatNumber(total)} {total === 1 ? "item" : "items"}
            {view === "table" && <> · Sorted by {columnLabel(sort)}</>}
            {filter && <> · Filtered by {filterMeta?.label}: {filter}</>}
          </p>
          <form action={base} className="flex flex-wrap items-center gap-2">
            {view === "kanban" && <input type="hidden" name="view" value="kanban" />}
            <label className="sr-only" htmlFor="scope">List view</label>
            <select id="scope" name="scope" defaultValue={scope} className="input h-8 w-auto">
              <option value="all">All {def.plural}</option>
              <option value="mine">My {def.plural}</option>
            </select>
            {filterMeta && (
              <>
                <label className="sr-only" htmlFor="filter">{filterMeta.label}</label>
                <select id="filter" name="filter" defaultValue={filter ?? ""} className="input h-8 w-auto">
                  <option value="">Any {filterMeta.label.toLowerCase()}</option>
                  {filterMeta.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <label className="sr-only" htmlFor="q">Search this list</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Search this list…" className="input w-56 pl-8" />
            </div>
            <button className="btn">Apply</button>
          </form>
        </div>
      </div>

      {error && <p role="alert" className="m-4 rounded-card bg-danger-light px-3 py-2 text-danger">{error.message}</p>}

      {view === "kanban" ? (
        <div className="p-3">
          <KanbanBoard
            currency={org.currency}
            stages={def.fields.stage!.options!}
            cards={rows.map(
              (r): KanbanCard => ({
                id: r.id as string,
                name: r.name as string,
                stage: r.stage as string,
                amount: (r.amount as number | null) ?? null,
                close_date: r.close_date as string,
                account: lookupLabel(def, "account_id", r),
              }),
            )}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-alt text-xs text-ink-muted">
                  <th scope="col" className="w-10 px-3 py-2 text-right font-normal">#</th>
                  {def.listColumns.map((c) => {
                    const active = sort === c;
                    const label = columnLabel(c);
                    return (
                      <th key={c} scope="col" aria-sort={active ? (ascending ? "ascending" : "descending") : undefined} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {sortable(c) ? (
                          <Link
                            href={withParams(base, sp, { sort: c, dir: active && ascending ? "desc" : "asc", page: null })}
                            className="inline-flex items-center gap-1 hover:text-ink"
                          >
                            {label}
                            {active && (ascending ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                          </Link>
                        ) : (
                          label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id as string} className="border-b border-line hover:bg-brand-light/40">
                    <td className="px-3 py-2 text-right text-xs text-ink-faint">{page * PAGE_SIZE + i + 1}</td>
                    {def.listColumns.map((c, ci) => (
                      <td key={c} className="max-w-72 truncate px-3 py-2">
                        {ci === 0 ? (
                          <Link href={`${base}/${r.id}`} className="link font-medium">
                            {c === "last_name" ? def.title(r) : c === "case_number" ? String(r.case_number) : String(r[c] ?? def.title(r))}
                          </Link>
                        ) : (
                          <FieldValue def={def} field={c} record={r} currency={org.currency} badge />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState>
                {q || filter || scope === "mine" ? (
                  <>No {def.plural.toLowerCase()} match this view. <Link href={base} className="link">Clear filters</Link></>
                ) : (
                  <>No {def.plural.toLowerCase()} yet. <Link href={`${base}/new`} className="link">Create one</Link></>
                )}
              </EmptyState>
            )}
          </div>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3 text-xs text-ink-muted">
              <span>
                Page {page + 1} of {pages}
              </span>
              <span className="flex gap-2">
                {page > 0 ? (
                  <Link href={withParams(base, sp, { page: String(page - 1) })} className="btn btn-sm">Previous</Link>
                ) : (
                  <span className="btn btn-sm" aria-disabled="true">Previous</span>
                )}
                {page + 1 < pages ? (
                  <Link href={withParams(base, sp, { page: String(page + 1) })} className="btn btn-sm">Next</Link>
                ) : (
                  <span className="btn btn-sm" aria-disabled="true">Next</span>
                )}
              </span>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
