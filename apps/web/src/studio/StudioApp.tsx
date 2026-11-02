/**
 * TRACEN Architecture Studio — shell. Hash-routed area (#/studio/<tab>)
 * inside the existing app. All state flows through useStudio (pure model +
 * local persistence); views are presentation only.
 */
import React, { useState } from "react";
import { Button } from "../trail/ui";
import { STUDIO_TABS, StudioTab, TrailRoute } from "../trail/router";
import { useStudio } from "./useStudio";
import { getScenario } from "./scenarios";
import { ScenariosView } from "./ScenariosView";
import { DesignView } from "./DesignView";
import { RequirementsView } from "./RequirementsView";
import { ValidateView } from "./ValidateView";
import { CapacityView } from "./CapacityView";
import { FailureView } from "./FailureView";
import { CompareView } from "./CompareView";
import { ReviewView } from "./ReviewView";
import { DecisionsView, Seed } from "./DecisionsView";
import { ChallengeView } from "./ChallengeView";
import { ExportView } from "./ExportView";

const TAB_LABEL: Record<StudioTab, string> = {
  scenarios: "Scenarios", design: "Design", requirements: "Requirements", validate: "Validate", capacity: "Capacity", failures: "Failure Lab",
  compare: "Compare", review: "Review", decisions: "Decisions", challenge: "Challenge", export: "Export",
};

export const StudioApp: React.FC<{ tab: StudioTab; navigate: (r: TrailRoute) => void }> = ({ tab, navigate }) => {
  const api = useStudio();
  const { ws, store, status } = api;
  const [seed, setSeed] = useState<Seed | null>(null);
  const scenario = ws ? getScenario(ws.scenarioId) : undefined;
  const go = (t: string) => navigate({ page: "studio", tab: (STUDIO_TABS.find((x) => x === t) ?? "scenarios") as StudioTab });
  const needsWs = tab !== "scenarios";

  return (
    <div className="mx-auto max-w-[96rem] px-3 py-5 sm:px-4" data-testid="studio">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-600/40 pb-3">
        <a href="#/studio" className="text-lg font-extrabold tracking-wide text-slate-100 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400">
          TRACEN <span className="font-bold text-sky-400">Architecture Studio</span>
        </a>
        <a href="#/trail" className="text-xs text-slate-400 underline hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400">← Vibe Coding Trail</a>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {store.workspaces.length > 0 && (
            <label className="flex items-center gap-1.5 text-slate-300">
              Open
              <select aria-label="Open architecture" className="max-w-[16rem] rounded-md border border-slate-500/50 bg-slate-900/70 px-2 py-1.5 text-sm text-slate-100" value={store.activeId ?? ""} onChange={(e) => api.open(e.target.value)}>
                {store.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}
          <span role="status" aria-live="polite" data-testid="save-status" className={status && !status.ok ? "font-semibold text-rose-300" : "text-slate-400"}>
            {status ? (status.ok ? `Saved ${new Date(status.at).toLocaleTimeString()}` : `Save failed: ${status.error}`) : ws ? "Autosave on" : ""}
          </span>
        </div>
      </header>

      <nav aria-label="Studio sections" className="mb-5 flex flex-wrap gap-1.5" data-testid="studio-tabs">
        {STUDIO_TABS.map((t) => (
          <a key={t} href={t === "scenarios" ? "#/studio" : `#/studio/${t}`} aria-current={tab === t ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-sky-400 ${tab === t ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-slate-600/50 bg-slate-700/30 text-slate-300 hover:bg-slate-700/60"}`}>
            {TAB_LABEL[t]}
          </a>
        ))}
      </nav>

      <main>
        <h1 className="sr-only">{TAB_LABEL[tab]} — TRACEN Architecture Studio</h1>
        {needsWs && (!ws || !scenario) ? (
          <div className="max-w-xl space-y-3 rounded-xl border border-dashed border-slate-600/50 p-6" data-testid="no-workspace">
            <h2 className="text-lg font-bold text-slate-100">Pick a scenario first</h2>
            <p className="text-sm text-slate-300">The {TAB_LABEL[tab]} workspace needs an architecture to work on. Choose one of the five scenarios to begin.</p>
            <Button variant="primary" onClick={() => go("scenarios")}>Choose a scenario</Button>
          </div>
        ) : (
          <>
            {ws && scenario && tab !== "scenarios" && (
              <p className="mb-3 text-xs text-slate-400">
                Working on <strong className="text-slate-200">{ws.name}</strong> · scenario {scenario.name}{ws.mode === "challenge" && <span className="ml-2 rounded border border-violet-400/50 px-1.5 text-violet-300">CHALLENGE MODE</span>}
              </p>
            )}
            {tab === "scenarios" && <ScenariosView api={api} go={go} />}
            {ws && scenario && tab === "design" && <DesignView api={api} ws={ws} scenario={scenario} go={go} onRecordDecision={(nodeId) => { setSeed({ nodeId }); go("decisions"); }} />}
            {ws && scenario && tab === "requirements" && <RequirementsView api={api} ws={ws} scenario={scenario} go={go} onRecordDecision={(requirementId) => { setSeed({ requirementId }); go("decisions"); }} />}
            {ws && scenario && tab === "validate" && <ValidateView api={api} ws={ws} scenario={scenario} />}
            {ws && scenario && tab === "capacity" && <CapacityView api={api} ws={ws} scenario={scenario} />}
            {ws && scenario && tab === "failures" && <FailureView api={api} ws={ws} />}
            {ws && scenario && tab === "compare" && <CompareView api={api} ws={ws} scenario={scenario} />}
            {ws && scenario && tab === "review" && <ReviewView api={api} ws={ws} scenario={scenario} />}
            {ws && scenario && tab === "decisions" && <DecisionsView api={api} ws={ws} scenario={scenario} seed={seed} clearSeed={() => setSeed(null)} />}
            {ws && scenario && tab === "challenge" && <ChallengeView api={api} ws={ws} scenario={scenario} go={go} />}
            {ws && scenario && tab === "export" && <ExportView api={api} ws={ws} scenario={scenario} />}
          </>
        )}
      </main>
    </div>
  );
};
