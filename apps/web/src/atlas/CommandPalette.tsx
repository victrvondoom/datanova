/**
 * Datanova Atlas — command palette + global search (Campaign 06, Task 34).
 * Searches sections, components (name/type/id), claims, and sources; runs
 * navigation and supported actions. Keyboard-operable (arrow keys + Enter).
 */

import React, { useMemo, useState } from "react";
import { ATLAS_SECTIONS, SECTION_LABELS, type AtlasSection } from "./router";
import type { AtlasState } from "./state";
import type { ArchitectureModel } from "../lab/model";
import { CLAIMS } from "../lab/engines/claims";
import { SOURCES } from "../lab/engines/sources";
import { AInput } from "./ui";

export interface PaletteItem {
  id: string;
  label: string;
  detail: string;
  kind: "section" | "component" | "claim" | "source" | "action";
  run: () => void;
}

export const CommandPalette: React.FC<{
  state: AtlasState;
  model: ArchitectureModel;
  onClose: () => void;
  onNavigate: (s: AtlasSection) => void;
  onRun: (cmd: () => void) => void;
}> = ({ model, onNavigate, onClose, onRun }) => {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const sections: PaletteItem[] = ATLAS_SECTIONS.map((s) => ({
      id: `sec:${s}`, label: SECTION_LABELS[s], detail: "Go to section", kind: "section",
      run: () => onNavigate(s),
    }));
    const components: PaletteItem[] = model.components.map((c) => ({
      id: `comp:${c.id}`, label: c.name, detail: `${c.kind} · ${c.id}`, kind: "component",
      run: () => onNavigate("studio"),
    }));
    const claims: PaletteItem[] = CLAIMS.map((c) => ({
      id: `claim:${c.id}`, label: c.statement, detail: `claim (${c.kind})`, kind: "claim",
      run: () => onNavigate("sources"),
    }));
    const sources: PaletteItem[] = SOURCES.map((s) => ({
      id: `src:${s.id}`, label: s.title, detail: `source · ${s.published}`, kind: "source",
      run: () => onNavigate("sources"),
    }));
    const all = [...sections, ...components, ...claims.slice(0, 24), ...sources];
    if (!query.trim()) return all.slice(0, 20);
    const q = query.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q)).slice(0, 20);
  }, [model, query, onNavigate]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center pt-24 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-slate-600 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <AInput
          autoFocus aria-label="Search or run a command"
          placeholder="Search components, sources, claims, sections…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && items[index]) { onRun(items[index].run); }
          }}
          className="!text-sm !border-0 !bg-transparent !px-4 !py-3 border-b !rounded-b-none border-slate-700"
        />
        <ul role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">No matches.</li>}
          {items.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === index}
              className={`px-3 py-2 rounded-md cursor-pointer text-xs ${i === index ? "bg-sky-500/15 text-sky-200" : "text-slate-300 hover:bg-slate-800"}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onRun(item.run)}>
              <div className="font-semibold">{item.label}</div>
              <div className="text-[10px] text-slate-500">{item.kind} · {item.detail}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
