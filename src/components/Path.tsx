"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { updatePicklist } from "@/app/(app)/actions";
import type { ObjectKey, PathDef } from "@/lib/objects";

/** Lightning "Path": stage chevrons with "Mark as Current" and a closing step. */
export function Path({
  objectKey,
  recordId,
  path,
  current,
  onConvert,
}: {
  objectKey: ObjectKey;
  recordId: string;
  path: PathDef;
  current: string;
  onConvert?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isClosed = path.closed.includes(current);
  const currentIndex = isClosed ? path.open.length : path.open.indexOf(current);
  const closedStep = isClosed ? current : path.closedLabel;
  const steps = [...path.open, closedStep];
  const focusIsClosedStep = selected === "__closed__" || (!selected && isClosed);

  function save(value: string) {
    if (value === "Converted" && onConvert) {
      onConvert();
      return;
    }
    startTransition(async () => {
      const res = await updatePicklist(objectKey, recordId, path.field, value);
      setError(res.error ?? null);
      if (!res.error) setSelected(null);
    });
  }

  const nextOpen = path.open[currentIndex + 1];

  return (
    <div className="card px-4 py-3">
      <ol className="flex gap-1 overflow-x-auto" aria-label={`${path.field === "stage" ? "Stage" : "Status"} path`}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const done = i < currentIndex;
          const isCurrent = i === currentIndex;
          const lost = last && isClosed && /Lost|Unqualified/.test(current);
          const chosen = last ? focusIsClosedStep && selected !== null : selected === step;
          return (
            <li key={step} className="min-w-28 flex-1">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => setSelected(last ? "__closed__" : step === current ? null : step)}
                className={clsx(
                  "flex h-8 w-full items-center justify-center gap-1 px-4 text-xs font-medium whitespace-nowrap transition-colors",
                  "[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,10px_50%)]",
                  i === 0 && "rounded-l-full [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]",
                  last && "rounded-r-full [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,10px_50%)]",
                  chosen
                    ? "bg-brand-dark text-white"
                    : lost
                      ? "bg-danger text-white"
                      : isCurrent && last
                        ? "bg-success text-white"
                        : isCurrent
                          ? "bg-brand text-white"
                          : done
                            ? "bg-success-light text-success hover:bg-success hover:text-white"
                            : "bg-canvas text-ink-muted hover:bg-line",
                )}
              >
                {done && <Check className="size-3.5" aria-hidden="true" />}
                {step}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {error ? <span className="text-danger">{error}</span> : <>Current: <strong className="text-ink">{current}</strong></>}
        </p>
        <div className="flex gap-2">
          {focusIsClosedStep && selected !== null ? (
            path.closed.map((c) => (
              <button key={c} type="button" disabled={pending || c === current} onClick={() => save(c)} className="btn btn-primary btn-sm">
                {c === "Converted" ? "Convert…" : `Mark ${c}`}
              </button>
            ))
          ) : selected && selected !== current ? (
            <button type="button" disabled={pending} onClick={() => save(selected)} className="btn btn-primary btn-sm">
              Mark as Current {path.field === "stage" ? "Stage" : "Status"}
            </button>
          ) : !isClosed && nextOpen ? (
            <button type="button" disabled={pending} onClick={() => save(nextOpen)} className="btn btn-primary btn-sm">
              <Check className="size-3.5" /> Mark {path.field === "stage" ? "Stage" : "Status"} as Complete
            </button>
          ) : !isClosed ? (
            <button type="button" onClick={() => setSelected("__closed__")} className="btn btn-primary btn-sm">
              Select Closed {path.field === "stage" ? "Stage" : "Status"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
