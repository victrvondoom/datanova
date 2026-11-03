/**
 * Security & trust panel: trust boundaries, data lineage, authorization
 * simulation, tenant isolation, and adversarial review.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../model";
import { crossings, analyzeBoundaries } from "../engines/trust";
import { analyzeLineage } from "../engines/lineage";
import { decide, enforcementPoints, enforcementGaps, leastPrivilegeReview } from "../engines/authz";
import { injectTenantFailures, compareStrategies } from "../engines/tenant";
import { reviewAdversarially, THREAT_LIBRARY } from "../engines/adversarial";
import { Panel, FindingsList, StateBadge, Callout } from "../ui";

export const SecurityPanel: React.FC<{ model: ArchitectureModel }> = ({ model }) => {
  const trust = useMemo(() => analyzeBoundaries(model), [model]);
  const lineage = useMemo(() => analyzeLineage(model), [model]);
  const gaps = useMemo(() => enforcementGaps(model), [model]);
  const eps = useMemo(() => enforcementPoints(model), [model]);
  const privReview = useMemo(() => leastPrivilegeReview(model), [model]);
  const tenant = useMemo(() => injectTenantFailures(model), [model]);
  const adversarial = useMemo(() => reviewAdversarially(model), [model]);
  const [principal, setPrincipal] = useState("tenant-user");
  const [action, setAction] = useState("read");
  const [resource, setResource] = useState("de-meta");
  const decision = useMemo(
    () => decide(model.policies ?? [], principal, action, resource),
    [model, principal, action, resource]);

  return (
    <div>
      <Panel title="Trust boundaries" subtitle="Zones, crossings, and the controls enforced on each crossing">
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 text-left">
              <th className="py-1 pr-3">Crossing</th><th className="pr-3">From zone</th><th className="pr-3">To zone</th>
              <th className="pr-3">Direction</th><th>Controls</th>
            </tr></thead>
            <tbody>
              {crossings(model).map((c) => (
                <tr key={c.connectionId} className="border-t border-slate-700/40">
                  <td className="py-1 pr-3 font-mono text-slate-200">{c.connectionId}</td>
                  <td className="pr-3 text-slate-300">{c.fromZone?.name}</td>
                  <td className="pr-3 text-slate-300">{c.toZone?.name}</td>
                  <td className="pr-3 text-slate-300">{c.trustDelta > 0 ? "into higher trust" : c.trustDelta < 0 ? "into lower trust" : "same level"}</td>
                  <td className="text-slate-300">{c.controls.join(", ") || <span className="text-rose-300">none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FindingsList findings={trust.findings} emptyText="Every crossing enforces appropriate controls." />
      </Panel>

      <Panel title="Data lineage and privacy exposure" subtitle="Where sensitive data lives, flows, expires, and gets deleted">
        <ul className="space-y-1 mb-3">
          {lineage.lineages.map((l) => (
            <li key={l.entityId} className="text-xs text-slate-300">
              <span className="font-semibold text-slate-100">{l.entityId}</span> ({l.classification})
              {" — holders: "}
              {l.nodes.map((n) => `${n.componentId} (${n.relation})`).join(", ")}
            </li>
          ))}
        </ul>
        <FindingsList findings={lineage.findings} emptyText="No exposure or retention gaps." />
      </Panel>

      <Panel title="Authorization flow" subtitle="Follow an authorization decision through the architecture"
        right={
          <div className="flex flex-wrap gap-1">
            <select value={principal} onChange={(e) => setPrincipal(e.target.value)}
              className="rounded bg-slate-800 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-100">
              {["tenant-user", "anonymous", "ops-admin"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={action} onChange={(e) => setAction(e.target.value)}
              className="rounded bg-slate-800 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-100">
              {["read", "write", "delete"].map((a) => <option key={a}>{a}</option>)}
            </select>
            <select value={resource} onChange={(e) => setResource(e.target.value)}
              className="rounded bg-slate-800 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-100">
              {model.dataEntities.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
            </select>
          </div>
        }>
        <div className="mb-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs">
          <span className="text-slate-300">Decision for</span> <span className="font-mono text-slate-100">{principal} / {action} / {resource}</span>
          <span className="ml-2 font-bold text-slate-100">= {decision.decision.toUpperCase()}</span>
          <span className="text-slate-400"> (deny overrides allow; default deny)</span>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">
          Enforcement points: {eps.map((e) => `${e.enforcer} on ${e.connectionId}`).join(", ") || "none declared"}
        </p>
        <FindingsList findings={[...gaps.findings, ...privReview]} emptyText="No authorization gaps." />
      </Panel>

      <Panel title="Multi-tenant isolation" subtitle="Where tenant context is established, propagated — and where it can be lost">
        <FindingsList findings={tenant.findings} emptyText="Every tenant-scoped store enforces isolation." />
        <div className="grid md:grid-cols-3 gap-2 mt-3">
          {compareStrategies().map((s) => (
            <div key={s.strategy} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
              <div className="text-xs font-semibold text-slate-100">{s.strategy}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{s.isolationStrength}</div>
              <p className="text-[11px] text-slate-300 mt-1">{s.description}</p>
              <p className="text-[10px] text-slate-400 mt-1">{s.tradeoff}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Adversarial review" subtitle="Abuse cases, the paths that enable them, and mitigation trade-offs">
        <ul className="space-y-2 mb-3">
          {adversarial.results.map((r) => {
            const scenario = THREAT_LIBRARY.find((t) => t.id === r.scenarioId)!;
            return (
              <li key={r.scenarioId} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <StateBadge severity={r.enabled ? "critical" : "info"} />
                  <span className="font-semibold text-slate-100">{scenario.name}</span>
                  <span className="text-slate-400">{r.enabled ? "ENABLED by this architecture" : "not enabled"}</span>
                </div>
                <p className="text-slate-300 mt-1">{scenario.description}</p>
                {r.enabled && (
                  <>
                    <p className="text-amber-200 mt-1">Enabling paths: {r.enablingPaths.join("; ")}</p>
                    <p className="text-slate-400 mt-1">Mitigation: {r.mitigation.control} at {r.mitigation.where} — trade-off: {r.mitigation.tradeoff}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <Callout kind="honest">
          Safe by construction: adversarial experiments run only against the local educational model —
          no external traffic, no real transactions, no credentials.
        </Callout>
      </Panel>
    </div>
  );
};
