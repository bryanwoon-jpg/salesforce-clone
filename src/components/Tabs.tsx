"use client";

import { useId, useState } from "react";
import clsx from "clsx";

export function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-line px-4">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((active + 1) % tabs.length);
              if (e.key === "ArrowLeft") setActive((active - 1 + tabs.length) % tabs.length);
            }}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm",
              active === i ? "border-brand font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={active !== i} className="p-4">
          {t.content}
        </div>
      ))}
    </div>
  );
}
