"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addNote, deleteNote, type FormState } from "@/app/(app)/actions";
import { formatDateTime } from "@/lib/format";

export interface NoteRow {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  author: string | null;
}

export function NotesPanel({ notes, links }: { notes: NoteRow[]; links: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addNote, {});
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const prevPending = useRef(false);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      form.current?.reset();
      setAdding(false);
    }
    prevPending.current = pending;
  }, [pending, state.error]);

  return (
    <div className="space-y-3">
      {adding ? (
        <form ref={form} action={action} className="space-y-2 rounded-card border border-line p-3">
          {Object.entries(links).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
          <label htmlFor="note-title" className="sr-only">Title</label>
          <input id="note-title" name="title" placeholder="Title" required className="input" />
          <label htmlFor="note-body" className="sr-only">Note</label>
          <textarea id="note-body" name="body" rows={3} placeholder="Write a note…" className="input" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn btn-sm">Cancel</button>
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-sm w-full">New Note</button>
      )}
      {deleteError && <p role="alert" className="text-xs text-danger">{deleteError}</p>}
      {notes.length === 0 && !adding && <p className="text-center text-xs text-ink-muted">No notes yet.</p>}
      <ul className="divide-y divide-line">
        {notes.map((n) => (
          <li key={n.id} className="group py-2">
            <div className="flex items-start gap-2">
              <p className="flex-1 font-semibold">{n.title}</p>
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteNote(n.id);
                    setDeleteError(res.error ?? null);
                  })
                }
                className="rounded p-0.5 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
                aria-label={`Delete note ${n.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {n.body && <p className="mt-0.5 whitespace-pre-wrap text-ink-muted">{n.body}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">
              {n.author ?? "Unknown"} · {formatDateTime(n.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
