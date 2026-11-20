"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { updatePicklist } from "@/app/(app)/actions";
import { formatCurrency, formatDate } from "@/lib/format";

export interface KanbanCard {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  close_date: string;
  account: string | null;
}

export function KanbanBoard({ cards, stages, currency }: { cards: KanbanCard[]; stages: readonly string[]; currency: string }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [optimistic, move] = useOptimistic(cards, (state, { id, stage }: { id: string; stage: string }) =>
    state.map((c) => (c.id === id ? { ...c, stage } : c)),
  );

  function drop(stage: string, id: string) {
    setDragOver(null);
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    startTransition(async () => {
      move({ id, stage });
      const res = await updatePicklist("opportunities", id, "stage", stage);
      setError(res.error ?? null);
    });
  }

  return (
    <div>
      {error && <p role="alert" className="mb-2 rounded-card bg-danger-light px-3 py-2 text-danger">{error}</p>}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const col = optimistic.filter((c) => c.stage === stage);
          const total = col.reduce((s, c) => s + (c.amount ?? 0), 0);
          return (
            <section
              key={stage}
              aria-label={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => drop(stage, e.dataTransfer.getData("text/plain"))}
              className={`flex w-64 shrink-0 flex-col rounded-card border bg-surface-alt ${dragOver === stage ? "border-brand bg-brand-light" : "border-line"}`}
            >
              <header className="border-b border-line px-3 py-2">
                <h3 className="text-xs font-bold tracking-wide uppercase">{stage}</h3>
                <p className="text-xs text-ink-muted">
                  {formatCurrency(total, currency, true)} · {col.length} {col.length === 1 ? "deal" : "deals"}
                </p>
              </header>
              <ul className="flex min-h-24 flex-col gap-2 p-2">
                {col.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="card cursor-grab p-2.5 active:cursor-grabbing"
                  >
                    <Link href={`/opportunities/${c.id}`} className="link font-semibold">{c.name}</Link>
                    {c.account && <p className="truncate text-xs text-ink-muted">{c.account}</p>}
                    <div className="mt-1.5 flex justify-between text-xs">
                      <span className="font-semibold">{formatCurrency(c.amount, currency)}</span>
                      <span className="text-ink-muted">{formatDate(c.close_date)}</span>
                    </div>
                    <label className="sr-only" htmlFor={`stage-${c.id}`}>Move {c.name} to stage</label>
                    <select
                      id={`stage-${c.id}`}
                      value={c.stage}
                      onChange={(e) => drop(e.target.value, c.id)}
                      className="mt-2 w-full rounded border border-line bg-surface px-1 py-0.5 text-xs text-ink-muted"
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
