import React, { useMemo } from "react";
import { Button, Callout } from "../trail/ui";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { StudioApi } from "./useStudio";
import { Panel } from "./parts";
import { download } from "./util";
import { challengeReportMarkdown, diagramSvg, safeFilename, specificationJson, specificationMarkdown } from "./exporters";
import { validateArchitecture } from "./validation";
import { adrsToMarkdown } from "./adr";
import { challengeSummary } from "./challenge";
import { getTopic } from "../trail/content";

export const ExportView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario }> = ({ api, ws, scenario }) => {
  const findings = useMemo(() => validateArchitecture(ws.arch, scenario), [ws.arch, scenario]);
  const svg = useMemo(() => diagramSvg(ws.arch, ws.name, scenario.name), [ws.arch, ws.name, scenario.name]);
  const now = () => new Date().toISOString();
  const spec = () => ({ workspaceName: ws.name, scenario, arch: ws.arch, adrs: ws.adrs, marks: ws.marks, findings, review: ws.review, capacity: ws.capacity, exportedAt: now() });
  const ch = ws.challenge;
  return (
    <div className="space-y-4">
      <Callout kind="info" title="Nothing sensitive leaves the browser">
        Exports are generated locally from your workspace. Property values and labels are scanned for credential-like strings (API keys, tokens, passwords) and replaced with “[redacted]”. Do not put secrets in free-text fields.
      </Callout>
      <Panel title="Architecture diagram" hint="Vector SVG with title, legend and labels">
        <div className="space-y-3">
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-600/40 bg-slate-950 p-2" data-testid="svg-preview">
            <img alt={`Preview of the exported diagram for ${ws.name}`} className="max-w-none" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} />
          </div>
          <Button variant="primary" onClick={() => download(safeFilename(ws.name, "svg"), svg, "image/svg+xml")}>Download diagram (SVG)</Button>
        </div>
      </Panel>
      <Panel title="Architecture specification" hint="Scenario, requirements, components, connections, configuration, decisions, risks, review">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => download(safeFilename(`${ws.name}-spec`, "md"), specificationMarkdown(spec()), "text/markdown")}>Download specification (Markdown)</Button>
          <Button onClick={() => download(safeFilename(`${ws.name}-spec`, "json"), specificationJson(spec()), "application/json")}>Download specification (JSON)</Button>
          <Button disabled={ws.adrs.length === 0} onClick={() => download(safeFilename(`${ws.name}-adrs`, "md"), adrsToMarkdown(ws.adrs, { arch: ws.arch, requirements: scenario.requirements, topicTitle: (t) => getTopic(t)?.title ?? "?" }), "text/markdown")}>Download ADRs (Markdown)</Button>
        </div>
        {!ws.review && <p className="mt-2 text-xs text-slate-500">No review has been generated, so the specification will say so. Generate one in the Review tab first for a complete export.</p>}
      </Panel>
      <Panel title="Challenge report">
        {ch?.finalized ? (
          <Button variant="primary" onClick={() => download(safeFilename(`${ws.name}-challenge-report`, "md"), challengeReportMarkdown({ workspaceName: ws.name, scenario, initial: ch.initialSnapshot, final: ws.arch, adrs: ws.adrs, summary: challengeSummary(ch, scenario, ws.arch, ws.adrs, ws.capacity), failuresRun: ch.failuresInjected, exportedAt: now() }), "text/markdown")}>Download challenge report</Button>
        ) : (
          <p className="text-sm text-slate-400" data-testid="no-challenge-report">The challenge report is available once a guided challenge is completed. No report is generated for unfinished work.</p>
        )}
      </Panel>
      <Panel title="Backup workspace" hint="Re-importable JSON (validated on import)">
        <Button onClick={() => download(safeFilename(ws.name, "json"), api.exportJson(ws), "application/json")}>Download workspace (JSON)</Button>
      </Panel>
    </div>
  );
};
