"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OBJECTS, type ObjectKey } from "@/lib/objects";
import { ObjectIcon } from "./ObjectIcon";

interface Hit {
  object_type: ObjectKey;
  id: string;
  title: string;
  subtitle: string | null;
}

export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("global_search", { p_query: q, p_limit: 12 });
      setHits((data as Hit[] | null) ?? []);
      setActive(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    router.push(`/${hit.object_type}/${hit.id}`);
  }

  return (
    <div ref={box} className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && query.trim().length >= 2}
        aria-controls={listId}
        aria-label="Search records"
        placeholder="Search accounts, contacts, leads, opportunities, cases…"
        className="input h-8 pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            go(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && query.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="card absolute top-full right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto py-1">
          {hits.length === 0 && <li className="px-3 py-2 text-ink-muted">{loading ? "Searching…" : "No results"}</li>}
          {hits.map((h, i) => (
            <li
              key={`${h.object_type}-${h.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "bg-brand-light" : ""}`}
            >
              <ObjectIcon name={OBJECTS[h.object_type].icon} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.title}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {OBJECTS[h.object_type].label}
                  {h.subtitle ? ` · ${h.subtitle}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
