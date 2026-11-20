import { getContext } from "@/lib/context";
import { Card } from "@/components/Card";
import { ObjectIcon } from "@/components/ObjectIcon";
import { Badge } from "@/components/Badge";
import { AddMemberForm, NewOrgForm, OrgSettingsForm } from "@/components/SettingsForms";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, org } = await getContext();
  const isAdmin = org.role === "admin";
  const { data: members } = await supabase
    .from("organization_members")
    .select("role, created_at, profile:profiles(id, full_name, email)")
    .eq("org_id", org.id)
    .order("created_at");

  type Member = { role: string; created_at: string; profile: { id: string; full_name: string | null; email: string | null } | null };

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="card flex items-center gap-3 px-4 py-3">
        <ObjectIcon name="settings" />
        <div>
          <p className="text-xs text-ink-muted">Setup</p>
          <h1 className="text-lg leading-tight font-bold">Organization Settings</h1>
        </div>
      </div>

      <Card title="Company Information">
        <OrgSettingsForm name={org.name} currency={org.currency} canEdit={isAdmin} />
      </Card>

      <Card title="Users" icon="contacts" count={members?.length ?? 0}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="py-1.5 pr-3 font-semibold">Name</th>
                <th className="py-1.5 pr-3 font-semibold">Email</th>
                <th className="py-1.5 pr-3 font-semibold">Role</th>
                <th className="py-1.5 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody>
              {((members ?? []) as unknown as Member[]).map((m) => (
                <tr key={m.profile?.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium">{m.profile?.full_name}</td>
                  <td className="py-2 pr-3 text-ink-muted">{m.profile?.email}</td>
                  <td className="py-2 pr-3"><Badge tone={m.role === "admin" ? "info" : "neutral"}>{m.role}</Badge></td>
                  <td className="py-2">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <div className="mt-4 border-t border-line pt-4">
            <AddMemberForm />
          </div>
        )}
      </Card>

      <Card title="Create another organization">
        <NewOrgForm />
      </Card>
    </div>
  );
}
