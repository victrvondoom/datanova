/**
 * Atlas — Sources (Tasks 31, 33): the source/claim registry explorer with
 * section references, dates, attribution, limitations, and the honest
 * external-vs-internal distinction.
 */

import React, { useMemo, useState } from "react";
import { SOURCES } from "../../lab/engines/sources";
import { CLAIMS, validateClaimRegistry } from "../../lab/engines/claims";
import { CASES, validateCaseLibrary } from "../../lab/engines/cases";
import { APanel, ABadge, AInput } from "../ui";

export const SourcesView: React.FC = () => {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"sources" | "claims" | "cases">("sources");
  const problems = useMemo(() => [...validateClaimRegistry(CLAIMS, SOURCES), ...validateCaseLibrary(CASES).map((c) => ({ claimId: c.caseId, problem: c.problem }))], []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (tab === "sources") return SOURCES.filter((s) => !q || s.title.toLowerCase().includes(q) || s.topics.join(" ").includes(q));
    if (tab === "claims") return CLAIMS.filter((c) => !q || c.statement.toLowerCase().includes(q) || c.kind.includes(q));
    return CASES.filter((c) => !q || c.title.toLowerCase().includes(q) || c.dimension.includes(q));
  }, [query, tab]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Sources</h1>
        <p className="text-xs text-slate-400">
          {SOURCES.length} primary sources · {CLAIMS.length} claims ({CLAIMS.filter((c) => c.kind === "external").length} externally
          grounded, {CLAIMS.filter((c) => c.kind !== "external").length} honestly internal) · {CASES.length} grounded cases.
          Registry integrity: {problems.length === 0 ? <ABadge status="ok" label="all invariants pass" /> : <ABadge status="bad" label={`${problems.length} problem(s)`} />}
        </p>
      </header>

      <div role="tablist" aria-label="Registry views" className="flex gap-1 mb-3">
        {(["sources", "claims", "cases"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${tab === t ? "border-sky-500/50 bg-sky-500/15 text-sky-200" : "border-slate-700 bg-slate-900/60 text-slate-400"}`}>
            {t}
          </button>
        ))}
        <AInput className="ml-auto max-w-64" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the registry" />
      </div>

      {tab === "sources" && (
        <div className="grid gap-3 md:grid-cols-2">
          {(filtered as typeof SOURCES).map((s) => (
            <APanel key={s.id} title={s.title} subtitle={`${s.author} · ${s.published}`}
              right={<ABadge status={s.category === "standard" ? "ok" : "info"} label={s.category} />}>
              <p className="text-xs text-slate-300">{s.note}</p>
              <p className="text-[11px] text-slate-500 mt-1">Section: {s.sectionRef}</p>
              <p className="text-[11px] text-slate-500">Accessed {s.accessed} · {s.attribution}</p>
              <p className="text-[11px] text-amber-300/80 mt-1">Limitations: {s.limitations}</p>
              <p className="text-[10px] text-sky-400 mt-1">{s.url}</p>
            </APanel>
          ))}
        </div>
      )}

      {tab === "claims" && (
        <APanel title="Claims" subtitle="Externally supported vs internal modeling assumptions — never conflated">
          <ul className="text-xs space-y-2">
            {(filtered as typeof CLAIMS).map((c) => (
              <li key={c.id} className="border border-slate-700/50 rounded-md p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <ABadge status={c.kind === "external" ? "ok" : "warn"} label={c.kind} />
                  <span className="text-slate-200">{c.statement}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {c.sources.map((sid) => SOURCES.find((s) => s.id === sid)?.title).filter(Boolean).join(" · ") || "internal — no external citation (honest)"}
                </p>
                {c.labDelta && <p className="text-[11px] text-slate-500">Beyond the sources: {c.labDelta}</p>}
                <p className="text-[10px] text-slate-600">applies to: {c.appliesTo.join(", ")}</p>
              </li>
            ))}
          </ul>
        </APanel>
      )}

      {tab === "cases" && (
        <div className="grid gap-3 md:grid-cols-2">
          {(filtered as typeof CASES).map((c) => (
            <APanel key={c.id} title={c.title} subtitle={`dimension: ${c.dimension}`}>
              <ul className="text-xs space-y-1">
                {c.facts.map((f, i) => <li key={i} className="text-slate-300"><ABadge status="ok" label="fact" /> {f.text} <span className="text-slate-600">[{f.sourceId}]</span></li>)}
                {c.adaptations.map((a, i) => <li key={i} className="text-slate-400"><ABadge status="warn" label="adaptation" /> {a}</li>)}
              </ul>
              <p className="text-[11px] text-slate-500 mt-1">Discussion: {c.discussionPoints[0]}</p>
            </APanel>
          ))}
        </div>
      )}
    </div>
  );
};
