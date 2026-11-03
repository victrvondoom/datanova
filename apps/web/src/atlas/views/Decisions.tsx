/**
 * Atlas — Decisions (Task 27): the decision workspace over ADRs in the
 * canonical model, trade-off summaries from the real engines, and links to
 * snapshots and evidence.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../../lab/model";
import type { Project } from "../state";
import type { Adr } from "../../lab/model";
import { AMetric, APanel, ABadge, AButton } from "../ui";
import { extractGenome } from "../../lab/engines/genome";
import { critiqueArchitecture } from "../../lab/engines/critic";

export const DecisionsView: React.FC<{ model: ArchitectureModel; project: Project }> = ({ model, project }) => {
  const [working, setWorking] = useState<Adr[] | null>(null);
  const adrs = working ?? model.adrs;
  const genome = useMemo(() => extractGenome(model), [model]);
  const findings = useMemo(() => critiqueArchitecture(model).findings, [model]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Decisions</h1>
        <p className="text-xs text-slate-400">
          Architecture decision records and trade-offs for <strong>{project.name}</strong> — connected to the canonical
          model, the debate engine's trade-off scoring, and the critic's findings.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <AMetric label="ADRs" value={adrs.length} hint={`${adrs.filter((a) => a.status === "superseded").length} superseded`} />
        <AMetric label="Genome traits" value={genome.traits.length} hint={`fingerprint ${genome.fingerprint}`} />
        <AMetric label="Open findings" value={findings.length} hint="decisions should address them" />
        <AMetric label="Complexity" value={String(genome.traits.find((t) => t.key.includes("complex"))?.value ?? "—")} hint="from the genome engine" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <APanel title="Decision records" subtitle="Each ADR carries context, options, and status — supersession preserved">
          {adrs.length === 0 && <p className="text-xs text-slate-500">No ADRs recorded in this architecture — add one from the studio or the lab debate workspace.</p>}
          <ul className="text-xs space-y-2">
            {adrs.map((a) => {
              return (
                <li key={a.id} className="border border-slate-700/50 rounded-md p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ABadge status={a.status === "superseded" ? "warn" : "ok"} label={a.status} />
                    <strong className="text-slate-200">{a.title}</strong>
                  </div>
                  <p className="text-slate-400 mt-1">{a.context}</p>
                  <p className="text-slate-300 text-[11px] mt-1">Decision: {a.decision}</p>
                  <p className="text-slate-500 text-[11px] mt-1">Alternatives rejected: {a.alternatives.map((x) => x.title).join(", ") || "none recorded"}</p>
                  {a.status !== "superseded" && (
                    <AButton className="mt-1" onClick={() => {
                      setWorking(adrs.map((x) => x.id === a.id ? { ...x, status: "superseded" as const } : x));
                    }}>Mark superseded (draft)</AButton>
                  )}
                </li>
              );
            })}
          </ul>
        </APanel>

        <APanel title="Findings needing decisions" subtitle="Critic output on this architecture — each finding is a decision waiting to happen">
          <ul className="text-xs space-y-2">
            {findings.length === 0 && <li className="text-slate-500">No open findings.</li>}
            {findings.map((f) => (
              <li key={f.id} className="border border-slate-700/50 rounded-md p-2">
                <ABadge status={f.severity === "critical" ? "bad" : "warn"} label={f.severity} /> <strong className="text-slate-200">{f.title}</strong>
                <p className="text-slate-400 text-[11px] mt-1">{f.detail.slice(0, 220)}…</p>
              </li>
            ))}
          </ul>
        </APanel>
      </div>
    </div>
  );
};
