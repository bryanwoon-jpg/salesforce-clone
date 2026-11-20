import Link from "next/link";
import { getContext } from "@/lib/context";
import { NAV_OBJECTS, OBJECTS } from "@/lib/objects";
import { LogoMark } from "@/components/Logo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NavTabs } from "@/components/NavTabs";
import { UserMenu } from "@/components/UserMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user, org, orgs } = await getContext();
  const nav = [
    { href: "/", label: "Home" },
    ...NAV_OBJECTS.map((k) => ({ href: `/${k}`, label: OBJECTS[k].plural })),
    { href: "/reports", label: "Reports" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40">
        <div className="flex h-12 items-center gap-4 border-b border-line bg-surface px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Cumulus CRM home">
            <LogoMark size={30} />
          </Link>
          <div className="flex flex-1 justify-center">
            <GlobalSearch />
          </div>
          <UserMenu name={profile.full_name ?? user.email ?? "User"} email={user.email} org={org} orgs={orgs} />
        </div>
        <NavTabs items={nav} />
      </header>
      <main className="flex-1 bg-gradient-to-b from-brand-light/60 to-canvas to-40% p-3 sm:p-4">{children}</main>
    </div>
  );
}
