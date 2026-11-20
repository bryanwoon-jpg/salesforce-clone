import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export interface OrgSummary {
  id: string;
  name: string;
  currency: string;
  role: "admin" | "manager" | "user";
}

export interface AppContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string | null };
  profile: { id: string; full_name: string | null; email: string | null; title: string | null };
  org: OrgSummary;
  orgs: OrgSummary[];
}

/** Signed-in user, profile and active organization. Redirects to /login when signed out. */
export const getContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, title, default_org_id").eq("id", user.id).single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, currency)")
      .eq("user_id", user.id),
  ]);

  const orgs: OrgSummary[] = (memberships ?? [])
    .map((m) => {
      const o = m.organizations as unknown as { id: string; name: string; currency: string } | null;
      return o ? { ...o, role: m.role as OrgSummary["role"] } : null;
    })
    .filter((o): o is OrgSummary => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!profile || orgs.length === 0) redirect("/auth/error?reason=no-organization");

  const org = orgs.find((o) => o.id === profile.default_org_id) ?? orgs[0]!;
  if (org.id !== profile.default_org_id) {
    await supabase.rpc("set_active_org", { p_org_id: org.id });
  }

  return {
    supabase,
    user: { id: user.id, email: user.email ?? null },
    profile: { id: profile.id, full_name: profile.full_name, email: profile.email, title: profile.title },
    org,
    orgs,
  };
});
