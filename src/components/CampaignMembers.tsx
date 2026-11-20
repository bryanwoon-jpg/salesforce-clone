"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { addCampaignMember, removeCampaignMember, type FormState } from "@/app/(app)/actions";
import { Badge } from "./Badge";

export interface MemberRow {
  id: string;
  kind: "lead" | "contact";
  memberId: string;
  name: string;
  company: string | null;
  status: string;
}

export function CampaignMembers({
  campaignId,
  members,
  candidates,
}: {
  campaignId: string;
  members: MemberRow[];
  candidates: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCampaignMember.bind(null, campaignId), {});
  const [removing, startRemove] = useTransition();
  const [adding, setAdding] = useState(false);
  const prev = useRef(false);

  useEffect(() => {
    if (prev.current && !pending && !state.error) setAdding(false);
    prev.current = pending;
  }, [pending, state.error]);

  return (
    <div>
      {members.length > 0 ? (
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1">
                <Link href={`/${m.kind === "lead" ? "leads" : "contacts"}/${m.memberId}`} className="link font-medium">{m.name}</Link>
                <span className="ml-2 text-xs text-ink-muted">{m.kind === "lead" ? "Lead" : "Contact"}{m.company ? ` · ${m.company}` : ""}</span>
              </span>
              <Badge>{m.status}</Badge>
              <button
                type="button"
                disabled={removing}
                onClick={() => startRemove(async () => void (await removeCampaignMember(m.id, campaignId)))}
                className="rounded p-0.5 text-ink-faint hover:text-danger"
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !adding && <p className="py-2 text-center text-ink-muted">No campaign members yet.</p>
      )}
      {adding ? (
        <form action={action} className="mt-3 grid grid-cols-1 gap-2 rounded-card border border-line p-3 md:grid-cols-3">
          {state.error && <p role="alert" className="col-span-full text-xs text-danger">{state.error}</p>}
          <div className="md:col-span-2">
            <label htmlFor="cm-member" className="label">Lead or Contact</label>
            <select id="cm-member" name="member" required className="input">
              <option value="">Select…</option>
              {candidates.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cm-status" className="label">Member Status</label>
            <select id="cm-status" name="status" className="input">
              <option>Sent</option>
              <option>Responded</option>
              <option>Attended</option>
            </select>
          </div>
          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn btn-sm">Cancel</button>
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add Member"}</button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setAdding(true)} className="btn btn-sm">Add Members</button>
        </div>
      )}
    </div>
  );
}
