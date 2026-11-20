import Link from "next/link";
import { getContext } from "@/lib/context";
import { OBJECTS, PICKLISTS, type ObjectKey } from "@/lib/objects";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Card, EmptyState } from "@/components/Card";
import { BarList, StatTile } from "@/components/Charts";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ActivityCheckbox } from "@/components/ActivityCheckbox";
import { Badge } from "@/components/Badge";

export const metadata = { title: "Home" };

function quarterStart(d = new Date()) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
}

export default async function HomePage() {
  const { supabase, org, user, profile } = await getContext();
  const today = new Date().toISOString().slice(0, 10);
  const qStart = quarterStart();

  const recentObjects: ObjectKey[] = ["opportunities", "accounts", "contacts", "leads", "cases"];

  const [openOpps, closedThisQuarter, pipeline, leads, openCases, tasks, closingSoon, ...recent] = await Promise.all([
    supabase.from("opportunities").select("amount, probability").eq("org_id", org.id).eq("is_closed", false),
    supabase.from("opportunities").select("amount, is_won").eq("org_id", org.id).eq("is_closed", true).gte("close_date", qStart),
    supabase.from("opportunity_pipeline").select("stage, deal_count, total_amount").eq("org_id", org.id),
    supabase.from("lead_funnel").select("status, lead_count").eq("org_id", org.id),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("org_id", org.id).neq("status", "Closed"),
    supabase
      .from("activities")
      .select("id, subject, type, status, due_date, priority")
      .eq("org_id", org.id)
      .eq("owner_id", user.id)
      .neq("status", "Completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("opportunities")
      .select("id, name, amount, stage, close_date, account:accounts!opportunities_account_id_fkey(name)")
      .eq("org_id", org.id)
      .eq("is_closed", false)
      .order("close_date", { ascending: true })
      .limit(6),
    ...recentObjects.map((k) =>
      supabase
        .from(k)
        .select(`id, updated_at, ${OBJECTS[k].titleColumns.join(",")}`)
        .eq("org_id", org.id)
        .order("updated_at", { ascending: false })
        .limit(5),
    ),
  ]);

  const open = openOpps.data ?? [];
  const openTotal = open.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const weighted = open.reduce((s, o) => s + (Number(o.amount ?? 0) * Number(o.probability ?? 0)) / 100, 0);
  const closed = closedThisQuarter.data ?? [];
  const won = closed.filter((o) => o.is_won);
  const wonTotal = won.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const winRate = closed.length ? Math.round((won.length / closed.length) * 100) : null;
  const openLeads = (leads.data ?? [])
    .filter((l) => !["Converted", "Unqualified"].includes(l.status as string))
    .reduce((s, l) => s + Number(l.lead_count), 0);

  const pipelineByStage = new Map((pipeline.data ?? []).map((p) => [p.stage as string, p]));
  const openStages = PICKLISTS.opportunity_stage.filter((s) => !s.startsWith("Closed"));
  const leadsByStatus = new Map((leads.data ?? []).map((l) => [l.status as string, Number(l.lead_count)]));

  const recentRows = recent
    .flatMap((res, i) => {
      const def = OBJECTS[recentObjects[i]!];
      return ((res.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        def,
        id: r.id as string,
        title: def.title(r),
        updated_at: r.updated_at as string,
      }));
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);

  const firstName = (profile.full_name ?? "").split(" ")[0];
  const quarterLabel = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;

  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-3 px-4 py-3">
        <ObjectIcon name="home" />
        <div>
          <p className="text-xs text-ink-muted">{org.name}</p>
          <h1 className="text-lg leading-tight font-bold">{firstName ? `Welcome back, ${firstName}` : "Home"}</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Open pipeline" value={formatCurrency(openTotal, org.currency, true)} detail={`${open.length} open deals`} />
        <StatTile label="Weighted pipeline" value={formatCurrency(weighted, org.currency, true)} detail="Amount × probability" />
        <StatTile label={`Closed won, ${quarterLabel}`} value={formatCurrency(wonTotal, org.currency, true)} detail={`${won.length} deals`} />
        <StatTile label={`Win rate, ${quarterLabel}`} value={winRate === null ? "–" : `${winRate}%`} detail={`${closed.length} deals closed`} />
        <StatTile label="Open leads / cases" value={`${formatNumber(openLeads)} / ${formatNumber(openCases.count ?? 0)}`} detail="Needing follow-up" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card title="Open pipeline by stage" icon="opportunities" className="lg:col-span-2" footer={<Link href="/opportunities?view=kanban" className="link">View pipeline board</Link>}>
          <BarList
            emptyText="No open opportunities yet."
            data={openStages.map((s) => {
              const p = pipelineByStage.get(s);
              const amount = Number(p?.total_amount ?? 0);
              return {
                label: s,
                value: amount,
                display: formatCurrency(amount, org.currency, true),
                detail: `${p?.deal_count ?? 0} deals`,
              };
            })}
          />
        </Card>

        <Card title="My open tasks" icon="activities" count={tasks.data?.length ?? 0} footer={<Link href="/activities?scope=mine" className="link">View all</Link>}>
          {(tasks.data ?? []).length === 0 ? (
            <EmptyState>You&apos;re all caught up.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {(tasks.data ?? []).map((t) => {
                const overdue = t.due_date && t.due_date < today;
                return (
                  <li key={t.id} className="flex items-start gap-2 py-2">
                    <ActivityCheckbox id={t.id} done={false} subject={t.subject} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/activities/${t.id}`} className="link block truncate font-medium">{t.subject}</Link>
                      <p className="text-xs text-ink-muted">
                        {t.type}
                        {t.due_date && (
                          <span className={overdue ? "font-semibold text-danger" : ""}> · {overdue ? "Overdue, " : "Due "}{formatDate(t.due_date)}</span>
                        )}
                      </p>
                    </div>
                    {t.priority === "High" && <Badge tone="warning">High</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Closing soon" icon="opportunities" className="lg:col-span-2">
          {(closingSoon.data ?? []).length === 0 ? (
            <EmptyState>No open opportunities.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th className="py-1.5 pr-3 font-semibold">Opportunity</th>
                    <th className="py-1.5 pr-3 font-semibold">Account</th>
                    <th className="py-1.5 pr-3 font-semibold">Stage</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Amount</th>
                    <th className="py-1.5 text-right font-semibold">Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(closingSoon.data ?? []).map((o) => {
                    const account = o.account as unknown as { name: string } | null;
                    return (
                      <tr key={o.id} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3"><Link href={`/opportunities/${o.id}`} className="link font-medium">{o.name}</Link></td>
                        <td className="py-2 pr-3 text-ink-muted">{account?.name}</td>
                        <td className="py-2 pr-3"><Badge>{o.stage}</Badge></td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(o.amount, org.currency)}</td>
                        <td className={`py-2 text-right ${o.close_date < today ? "font-semibold text-danger" : ""}`}>{formatDate(o.close_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent records">
          {recentRows.length === 0 ? (
            <EmptyState>Nothing here yet.</EmptyState>
          ) : (
            <ul className="space-y-1">
              {recentRows.map((r) => (
                <li key={`${r.def.key}-${r.id}`} className="flex items-center gap-2 py-1">
                  <ObjectIcon name={r.def.icon} size="sm" />
                  <Link href={`/${r.def.key}/${r.id}`} className="link min-w-0 flex-1 truncate">{r.title}</Link>
                  <span className="text-[11px] text-ink-faint">{r.def.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Leads by status" icon="leads" className="lg:col-span-3">
          <BarList
            emptyText="No leads yet."
            data={PICKLISTS.lead_status.map((s) => {
              const n = leadsByStatus.get(s) ?? 0;
              return { label: s, value: n, display: formatNumber(n) };
            })}
          />
        </Card>
      </div>
    </div>
  );
}
