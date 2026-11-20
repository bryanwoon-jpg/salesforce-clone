"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLead } from "@/app/(app)/actions";
import { Modal } from "./Modal";
import type { LookupOption } from "@/lib/lookups";

const ConvertCtx = createContext<() => void>(() => {});
export const useOpenConvert = () => useContext(ConvertCtx);

/** Provides the Convert dialog to the header button and the Path. */
export function ConvertLeadProvider({
  leadId,
  company,
  converted,
  accounts,
  children,
}: {
  leadId: string;
  company: string;
  converted: boolean;
  accounts: LookupOption[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [accountId, setAccountId] = useState("");
  const [createOpp, setCreateOpp] = useState(true);
  const [oppName, setOppName] = useState(`${company} - New Business`);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function convert() {
    if (mode === "existing" && !accountId) {
      setError("Choose an account.");
      return;
    }
    startTransition(async () => {
      const res = await convertLead(leadId, {
        accountId: mode === "existing" ? accountId : null,
        createOpportunity: createOpp,
        opportunityName: oppName,
      });
      if (res.error) return setError(res.error);
      setOpen(false);
      const r = res.result!;
      router.push(r.opportunity_id ? `/opportunities/${r.opportunity_id}` : `/contacts/${r.contact_id}`);
    });
  }

  return (
    <ConvertCtx.Provider value={() => !converted && setOpen(true)}>
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Convert Lead"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
            <button type="button" disabled={pending} onClick={convert} className="btn btn-primary">
              {pending ? "Converting…" : "Convert"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <p role="alert" className="rounded-card bg-danger-light px-3 py-2 text-danger">{error}</p>}
          <fieldset className="rounded-card border border-line p-4">
            <legend className="px-1 font-semibold">Account</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="acc" checked={mode === "new"} onChange={() => setMode("new")} className="accent-brand" />
              Create new: <strong>{company}</strong>
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input type="radio" name="acc" checked={mode === "existing"} onChange={() => setMode("existing")} className="accent-brand" />
              Choose existing
            </label>
            {mode === "existing" && (
              <>
                <label htmlFor="convert-account" className="sr-only">Existing account</label>
                <select id="convert-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input mt-2">
                  <option value="">Select an account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </>
            )}
          </fieldset>
          <fieldset className="rounded-card border border-line p-4">
            <legend className="px-1 font-semibold">Contact</legend>
            <p className="text-ink-muted">A new contact is created from the lead&apos;s name, title, email and phone.</p>
          </fieldset>
          <fieldset className="rounded-card border border-line p-4">
            <legend className="px-1 font-semibold">Opportunity</legend>
            <label htmlFor="convert-opp" className="label">Opportunity Name</label>
            <input id="convert-opp" value={oppName} onChange={(e) => setOppName(e.target.value)} disabled={!createOpp} className="input" />
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={!createOpp} onChange={(e) => setCreateOpp(!e.target.checked)} className="accent-brand" />
              Don&apos;t create an opportunity upon conversion
            </label>
          </fieldset>
        </div>
      </Modal>
    </ConvertCtx.Provider>
  );
}

export function ConvertButton() {
  const open = useOpenConvert();
  return (
    <button type="button" onClick={open} className="btn">Convert</button>
  );
}
