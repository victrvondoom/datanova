/**
 * Causality panel: inject a failure, inspect the causal chain, blast radius,
 * criticality, and the architecture genome.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { causalFindings, propagate } from "../engines/causal";
import { blastRadius, criticality } from "../engines/blastradius";
import { extractGenome, compareGenomes } from "../engines/genome";
import { docflowModel } from "../samples";
import { Panel, FindingsList, Callout, Metric, Btn } from "../ui";

export const CausalityPanel: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const [target, setTarget] = useState("meta-db");
  const [fault, setFault] = useState<"down" | "slow">("down");
  const prop = useMemo(() => propagate(model, { componentId: target, fault }), [model, target, fault]);
  const findings = useMemo(() => causalFindings(model, { componentId: target, fault }), [model, target, fault]);
  const br = useMemo(() => blastRadius(model, target, fault), [model, target, fault]);
  const genome = useMemo(() => extractGenome(model), [model]);
  const genomeVsReference = useMemo(() => compareGenomes(extractGenome(docflowModel()), genome), [genome]);

  return (
    <div>
      <Panel title="Failure injection" subtitle="Trigger a modeled failure and inspect the causal chain — not just a red component">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-xs text-slate-300" htmlFor="fault-target">Failed component:</label>
          <select id="fault-target" value={target} onChange={(e) => setTarget(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
            {model.components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="text-xs text-slate-300" htmlFor="fault-kind">Fault:</label>
          <select id="fault-kind" value={fault} onChange={(e) => setFault(e.target.value as "down" | "slow")}
            className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
            <option value="down">down (failure)</option>
            <option value="slow">slow (latency x2)</option>
          </select>
          <Btn onClick={() => { setTarget("analytics"); setFault("down"); }}>Try isolated: analytics down</Btn>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Metric label="Affected components" value={prop.chains.length}
            hint={`of ${model.components.length - 1} others`} />
          <Metric label="Impacted operations" value={br.impactedOperations.length} />
          <Metric label="Boundary edges" value={br.protectedByBoundaries.length} hint="limit propagation" />
          <Metric label="Without isolation" value={br.withoutIsolation.affectedCount}
            hint={`affected if every edge blocked — compare`} />
        </div>
        <FindingsList findings={findings} />
        <Callout kind="honest">
          Deterministic educational model. Rules fired: {prop.events.map((e) => e.ruleId).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "—"}.
          Confidence and assumptions: {prop.assumptions[0]}
        </Callout>
      </Panel>

      <Panel title="Blast radius" subtitle="Which user-visible capabilities are affected, and why (direct vs indirect)">
        <ul className="space-y-2">
          {br.impactedOperations.length === 0 && <li className="text-xs text-slate-400">No operation is impacted by this failure.</li>}
          {br.impactedOperations.map((o) => (
            <li key={o.operationId} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs">
              <div className="font-semibold text-slate-100">{o.operationName}
                <span className="ml-2 text-slate-400">(criticality {o.criticality})</span></div>
              <div className="text-slate-300 mt-1">Direct impact: {o.directImpactedComponents.join(", ") || "—"}</div>
              <div className="text-slate-400">Indirect impact: {o.indirectImpactedComponents.join(", ") || "—"}</div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Criticality" subtitle="Explicit factors: operation importance, dependents, data ownership, statefulness">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 text-left">
              <th className="py-1 pr-3">Component</th><th className="pr-3">Score</th>
              <th className="pr-3">Max op criticality</th><th className="pr-3">Dependents</th><th>Owns entities</th>
            </tr></thead>
            <tbody>
              {model.components.map((c) => {
                const k = criticality(model, c.id)!;
                return (
                  <tr key={c.id} className="border-t border-slate-700/40">
                    <td className="py-1 pr-3 text-slate-100">{c.name}</td>
                    <td className="pr-3 font-bold text-slate-200">{k.score}</td>
                    <td className="pr-3 text-slate-300">{k.maxOperationCriticality}</td>
                    <td className="pr-3 text-slate-300">{k.dependents}</td>
                    <td className="text-slate-300">{k.ownsDataEntities}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Architecture genome" subtitle={`Fingerprint ${genome.fingerprint} — behavior-level traits derived from the model`}
        right={<span className="text-[10px] text-slate-400">{genomeVsReference.length} trait(s) differ from the DocFlow reference</span>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {genome.traits.map((t) => (
            <Metric key={t.key} label={t.label} value={typeof t.value === "number" ? Math.round(t.value * 1000) / 1000 : t.value}
              hint={t.derivedFrom} />
          ))}
        </div>
      </Panel>
    </div>
  );
};
