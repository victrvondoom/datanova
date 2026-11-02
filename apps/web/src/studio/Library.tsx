import React, { useState } from "react";
import { CATEGORY_LABELS, Category, KIND_DEFS, KIND_LIST, Kind } from "./model";
import { CATEGORY_COLOR } from "./visual";
import { getTopic } from "../trail/content";

const CATS: Category[] = ["entry", "application", "data", "async", "reliability", "distributed"];

/** Compact palette above the canvas: gives the canvas the full width. Collapsed by default on phones. */
export const Library: React.FC<{ onAdd: (k: Kind) => void; disabled?: boolean }> = ({ onAdd, disabled }) => {
  const [open, setOpen] = useState<boolean>(() => typeof window === "undefined" || window.innerWidth >= 1024);
  return (
    <section className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-3" aria-label="Component library" data-testid="library">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-sm font-bold uppercase tracking-wider text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Component library <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        <p className="text-[11px] text-slate-400">Add only what a requirement needs — not every system needs every component. Hover a component for what it teaches.</p>
      </div>
      {open && (
        <div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {CATS.map((cat) => (
            <div key={cat}>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_COLOR[cat] }} />
                {CATEGORY_LABELS[cat]}
              </h4>
              <ul className="flex flex-wrap gap-1.5">
                {KIND_LIST.filter((k) => KIND_DEFS[k].category === cat).map((k) => (
                  <li key={k}>
                    <button
                      type="button" disabled={disabled} onClick={() => onAdd(k)}
                      aria-label={`Add ${KIND_DEFS[k].label}`}
                      title={`${KIND_DEFS[k].short}. Teaches: ${KIND_DEFS[k].topics.map((t) => getTopic(t)?.title).join(", ")}`}
                      className="rounded-md border border-slate-600/50 bg-slate-900/50 px-2 py-1 text-xs font-semibold text-slate-100 hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40"
                    >
                      + {KIND_DEFS[k].label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
