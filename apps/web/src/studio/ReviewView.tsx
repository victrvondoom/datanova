import React from "react";
import { Button } from "../trail/ui";
import { Workspace } from "./store";
import { Scenario } from "./scenarios";
import { StudioApi } from "./useStudio";
import { archFingerprint } from "./model";
import { reviewArchitecture } from "./review";
import { Panel, TopicLinks } from "./parts";

const Block: React.FC<{ title: string; items: string[]; empty?: string }> = ({ title, items, empty = "—" }) => (
  <div>
    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h5>
    {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-sm text-slate-200">{items.map((i) => <li key={i}>{i}</li>)}</ul>}
  </div>
);

export const ReviewView: React.FC<{ api: StudioApi; ws: Workspace; scenario: Scenario }> = ({ api, ws, scenario }) => {
  const rv = ws.review;
  const stale = rv && rv.fingerprint !== archFingerprint(ws.arch);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => api.update((w) => ({ ...w, review: reviewArchitecture(w.arch, scenario, w.adrs, new Date().toISOString(), w.capacity) }))}>{rv ? "Regenerate review" : "Generate review"}</Button>
        {rv && <span className="text-xs text-slate-400" data-testid="review-meta">Generated {new Date(rv.generatedAt).toLocaleString()} · {rv.findingCount} validation finding(s) considered</span>}
        {stale && <span role="status" className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">The architecture changed since this review — regenerate it.</span>}
      </div>
      <p className="max-w-3xl text-sm text-slate-300">The review reads your diagram, validation findings, capacity assumptions and the Failure Lab model. Each category lists evidence, what is missing, risks, questions and where to study — with no single opaque score.</p>
      {!rv ? (
        <div className="rounded-xl border border-dashed border-slate-600/50 p-6 text-sm text-slate-400" data-testid="review-empty">No review yet. Press <strong>Generate review</strong>.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="review-cards">
          {rv.categories.map((c) => (
            <Panel key={c.id} title={c.label}>
              <div className="space-y-3" data-testid={`review-${c.id}`}>
                <Block title="Evidence found" items={c.evidence} />
                <Block title="Missing evidence" items={c.missing} empty="Nothing flagged as missing." />
                <Block title="Risks" items={c.risks} empty="No findings in this category." />
                <Block title="Questions to answer" items={c.questions} />
                <div><h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Relevant topics</h5><TopicLinks topics={c.topics} /></div>
                <p className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100"><strong>Next investigation:</strong> {c.next}</p>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
};
