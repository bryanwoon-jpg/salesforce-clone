"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarDays, CheckSquare, Mail, Phone } from "lucide-react";
import clsx from "clsx";
import { logActivity, type FormState } from "@/app/(app)/actions";

const KINDS = [
  { type: "Task", label: "New Task", icon: CheckSquare, subject: "Follow up" },
  { type: "Call", label: "Log a Call", icon: Phone, subject: "Call" },
  { type: "Email", label: "Email", icon: Mail, subject: "Email" },
  { type: "Meeting", label: "New Event", icon: CalendarDays, subject: "Meeting" },
] as const;

export function ActivityComposer({ links }: { links: Record<string, string> }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["type"]>("Task");
  const [state, action, pending] = useActionState<FormState, FormData>(logActivity, {});
  const form = useRef<HTMLFormElement>(null);
  const prevPending = useRef(false);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) form.current?.reset();
    prevPending.current = pending;
  }, [pending, state.error]);

  const current = KINDS.find((k) => k.type === kind)!;
  const logged = kind === "Call" || kind === "Email";

  return (
    <div>
      <div role="tablist" aria-label="Activity type" className="mb-3 grid grid-cols-4 gap-1">
        {KINDS.map((k) => (
          <button
            key={k.type}
            type="button"
            role="tab"
            aria-selected={kind === k.type}
            onClick={() => setKind(k.type)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-card border px-1 py-1.5 text-[11px]",
              kind === k.type ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line text-ink-muted hover:bg-canvas",
            )}
          >
            <k.icon className="size-4" aria-hidden="true" />
            {k.label}
          </button>
        ))}
      </div>
      <form ref={form} action={action} className="space-y-2">
        <input type="hidden" name="type" value={kind} />
        {Object.entries(links).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
        <div>
          <label htmlFor="act-subject" className="label">Subject</label>
          <input id="act-subject" name="subject" required placeholder={current.subject} className="input" />
        </div>
        {!logged && (
          <div>
            <label htmlFor="act-due" className="label">{kind === "Meeting" ? "Date" : "Due Date"}</label>
            <input id="act-due" name="due_date" type="date" className="input" />
          </div>
        )}
        <div>
          <label htmlFor="act-desc" className="label">{logged ? "Comments" : "Description"}</label>
          <textarea id="act-desc" name="description" rows={2} className="input" />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? "Saving…" : logged ? "Log" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
