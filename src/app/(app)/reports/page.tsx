import { getContext } from "@/lib/context";
import { PICKLISTS } from "@/lib/objects";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card } from "@/components/Card";
import { BarList, ColumnChart, HeatTable } from "@/components/Charts";
import { ObjectIcon } from "@/components/ObjectIcon";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase, org } = await getContext();

  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  const sinceIso = since.toISOString().slice(0, 10);

  const [pipeline, monthly, cases, opps, sources] = await Promise.all([
    supabase.from("opportunity_pipeline").select("stage, deal_count, total_amount, weighted_amount").eq("org_id", org.id),
    supabase.from("monthly_closed_won").select("month, deal_count, total_amount").eq("org_id", org.id).gte("month", sinceIso),
    supabase.from("cases_by_status").select("status, priority, case_count").eq("org_id", org.id),
    supabase
      .from("opportunities")
      .select("amount, is_closed, is_won, owner:profiles!opportunities_owner_id_fkey(full_name)")
      .eq("org_id", org.id),
    supabase.from("opportunities").select("lead_source, amount").eq("org_id", org.id).eq("is_won", true),
  ]);

  const byStage = new Map((pipeline.data ?? []).map((p) => [p.stage as string, p]));

  // Last 12 months, oldest first, including empty months.
  const monthMap = new Map((monthly.data ?? []).map((m) => [String(m.month).slice(0, 7), m]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = monthMap.get(key);
    return {
      label: d.toLocaleDateString("en-SG", { month: "short" }),
      value: Number(m?.total_amount ?? 0),
      display: formatCurrency(m?.total_amount ?? 0, org.currency, true),
      detail: `${m?.deal_count ?? 0} deals`,
    };
  });

  const caseCount = (status: string, priority: string) =>
    (cases.data ?? []).filter((c) => c.status === status && c.priority === priority).reduce((s, c) => s + Number(c.case_count), 0);

  type OppRow = { amount: number | null; is_closed: boolean; is_won: boolean; owner: { full_name: string | null } | null };
  const ownerMap = new Map<string, { open: number; won: number }>();
  for (const o of (opps.data ?? []) as unknown as OppRow[]) {
    const name = o.owner?.full_name ?? "Unassigned";
    const e = ownerMap.get(name) ?? { open: 0, won: 0 };
    if (!o.is_closed) e.open += Number(o.amount ?? 0);
    if (o.is_won) e.won += Number(o.amount ?? 0);
    ownerMap.set(name, e);
  }
  const owners = [...ownerMap.entries()].sort((a, b) => b[1].won - a[1].won);

  const sourceMap = new Map<string, number>();
  for (const s of sources.data ?? []) {
    const k = (s.lead_source as string | null) ?? "None";
    sourceMap.set(k, (sourceMap.get(k) ?? 0) + Number(s.amount ?? 0));
  }

  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-3 px-4 py-3">
        <ObjectIcon name="reports" />
        <div>
          <p className="text-xs text-ink-muted">Reports</p>
          <h1 className="text-lg leading-tight font-bold">Sales &amp; Service Overview</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Closed won by month (last 12 months)" icon="opportunities" className="lg:col-span-2">
          <ColumnChart data={months} emptyText="No closed-won deals in the last 12 months." />
        </Card>

        <Card title="Pipeline by stage" icon="opportunities">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="py-1.5 pr-3 font-semibold">Stage</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Deals</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Amount</th>
                  <th className="py-1.5 text-right font-semibold">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {PICKLISTS.opportunity_stage.map((s) => {
                  const p = byStage.get(s);
                  return (
                    <tr key={s} className="border-b border-line last:border-0">
                      <td className="py-1.5 pr-3">{s}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(p?.deal_count ?? 0)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(p?.total_amount ?? 0, org.currency)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatCurrency(p?.weighted_amount ?? 0, org.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Cases by status and priority" icon="cases">
          <HeatTable
            caption="Number of cases by status and priority"
            rows={PICKLISTS.case_status}
            columns={PICKLISTS.case_priority}
            value={caseCount}
          />
        </Card>

        <Card title="Closed won by owner" icon="contacts">
          <BarList
            emptyText="No closed-won deals yet."
            data={owners.map(([name, v]) => ({
              label: name,
              value: v.won,
              display: formatCurrency(v.won, org.currency, true),
              detail: `Open: ${formatCurrency(v.open, org.currency, true)}`,
            }))}
          />
        </Card>

        <Card title="Closed won by lead source" icon="leads">
          <BarList
            emptyText="No closed-won deals yet."
            data={[...sourceMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => ({ label, value, display: formatCurrency(value, org.currency, true) }))}
          />
        </Card>
      </div>
    </div>
  );
}
