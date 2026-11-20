"use client";

import { useOptimistic, useTransition } from "react";
import { setActivityDone } from "@/app/(app)/actions";

export function ActivityCheckbox({ id, done, subject }: { id: string; done: boolean; subject: string }) {
  const [, start] = useTransition();
  const [checked, setChecked] = useOptimistic(done);
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={`Mark "${subject}" ${checked ? "not complete" : "complete"}`}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          setChecked(next);
          await setActivityDone(id, next);
        });
      }}
      className="mt-0.5 size-4 shrink-0 accent-success"
    />
  );
}
