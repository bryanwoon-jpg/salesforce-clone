"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, LogOut, Settings } from "lucide-react";
import { switchOrg } from "@/app/(app)/actions";
import { initials } from "@/lib/format";
import type { OrgSummary } from "@/lib/context";

export function UserMenu({ name, email, org, orgs }: { name: string; email: string | null; org: OrgSummary; orgs: OrgSummary[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-card px-1.5 py-1 hover:bg-canvas"
      >
        <span className="hidden text-right sm:block">
          <span className="block max-w-40 truncate text-xs font-semibold">{org.name}</span>
          <span className="block max-w-40 truncate text-[11px] text-ink-muted">{name}</span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-dark text-xs font-semibold text-white">{initials(name)}</span>
        <ChevronDown className="size-4 text-ink-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="card absolute top-full right-0 z-50 mt-1 w-72 py-2">
          <div className="border-b border-line px-4 pb-2">
            <p className="font-semibold">{name}</p>
            {email && <p className="truncate text-xs text-ink-muted">{email}</p>}
          </div>
          <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Organizations</p>
          {orgs.map((o) => (
            <button
              key={o.id}
              role="menuitem"
              type="button"
              disabled={pending || o.id === org.id}
              onClick={() => startTransition(() => switchOrg(o.id))}
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-canvas disabled:cursor-default"
            >
              <span className="size-4">{o.id === org.id && <Check className="size-4 text-brand" />}</span>
              <span className="flex-1 truncate">{o.name}</span>
              <span className="text-[11px] text-ink-faint capitalize">{o.role}</span>
            </button>
          ))}
          <div className="mt-2 border-t border-line pt-2">
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-1.5 hover:bg-canvas">
              <Settings className="size-4 text-ink-muted" /> Settings
            </Link>
            <form action="/auth/signout" method="post">
              <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-canvas">
                <LogOut className="size-4 text-ink-muted" /> Log Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
