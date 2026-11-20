"use client";

import { useActionState } from "react";
import { addMember, createOrganization, updateOrganization, type FormState } from "@/app/(app)/actions";

function Status({ state, pending, ok }: { state: FormState; pending: boolean; ok?: string }) {
  if (state.error) return <p role="alert" className="text-xs text-danger">{state.error}</p>;
  if (!pending && ok) return <p role="status" className="text-xs text-success">{ok}</p>;
  return null;
}

export function OrgSettingsForm({ name, currency, canEdit }: { name: string; currency: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateOrganization, {});
  return (
    <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_8rem_auto] md:items-end">
      <div>
        <label htmlFor="org-name" className="label">Organization Name</label>
        <input id="org-name" name="name" defaultValue={name} disabled={!canEdit} required className="input" />
      </div>
      <div>
        <label htmlFor="org-currency" className="label">Currency</label>
        <input id="org-currency" name="currency" defaultValue={currency} disabled={!canEdit} maxLength={3} className="input uppercase" />
      </div>
      <button type="submit" disabled={!canEdit || pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
      <div className="md:col-span-3">
        <Status state={state} pending={pending} />
        {!canEdit && <p className="text-xs text-ink-muted">Only admins can change organization settings.</p>}
      </div>
    </form>
  );
}

export function AddMemberForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addMember, {});
  return (
    <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_9rem_auto] md:items-end">
      <div>
        <label htmlFor="member-email" className="label">User email (they must have signed up)</label>
        <input id="member-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="member-role" className="label">Role</label>
        <select id="member-role" name="role" defaultValue="user" className="input">
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Adding…" : "Add User"}</button>
      <div className="md:col-span-3">
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function NewOrgForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganization, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="new-org" className="label">Organization Name</label>
        <input id="new-org" name="name" required className="input" />
      </div>
      <label className="flex items-center gap-2 text-ink-muted">
        <input type="checkbox" name="seed_demo" className="size-4 accent-brand" /> Load sample data
      </label>
      <Status state={state} pending={pending} />
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create Organization"}</button>
    </form>
  );
}
