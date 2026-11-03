/**
 * Architecture Intelligence Lab — campaign 03 view shell.
 * Mounted like the trail (hash routes #/lab/...), no new dependencies.
 */

import React, { useEffect, useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { parseModel, serializeModel, type ArchitectureModel } from "./model";
import { BUILTIN_ARCHETYPES, loadLabState, resetLabState, saveLabState, type LabState, type LearningMode } from "./store";
import { LAB_TABS, TAB_LABELS, useLabTab } from "./router";
import { OverviewPanel } from "./panels/Overview";
import { IntentPanel } from "./panels/Intent";
import { CausalityPanel } from "./panels/Causality";
import { ReasoningPanel } from "./panels/Reasoning";
import { DataPanel } from "./panels/Data";
import { SecurityPanel } from "./panels/Security";
import { ExperimentsPanel } from "./panels/Experiments";
import { ReviewPanel } from "./panels/Review";
import { CapstonePanel } from "./panels/Capstone";
import { Btn, Callout } from "./ui";

export const LabApp: React.FC = () => {
  const [state, setState] = useState<LabState>(() => loadLabState(window.localStorage));
  const [tab, navigate] = useLabTab();
  const [adrLog, setAdrLog] = useState<string[]>([]);
  const model = useMemo<ArchitectureModel>(() => parseModel(state.modelJson), [state.modelJson]);

  useEffect(() => {
    saveLabState(window.localStorage, state);
  }, [state]);

  const setModel = (m: ArchitectureModel): void => {
    setState((s) => ({ ...s, modelJson: serializeModel(m) }));
  };

  const adoptBuiltin = (archId: string): void => {
    const builtin = BUILTIN_ARCHETYPES.find((b) => b.id === archId);
    if (builtin) setState((s) => ({ ...s, archId, modelJson: serializeModel(builtin.build()) }));
  };

  const reset = (): void => setState(resetLabState(window.localStorage));

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2 text-slate-100">
              <FlaskConical size={22} aria-hidden /> Architecture Intelligence Lab
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Architectures that explain their intent, expose their risks, simulate their failure paths,
              compare alternatives, and support their claims with reproducible evidence.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="arch-select" className="text-xs text-slate-300">Architecture</label>
            <select id="arch-select" value={state.archId} onChange={(e) => adoptBuiltin(e.target.value)}
              className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
              {BUILTIN_ARCHETYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              {state.archId === "custom" && <option value="custom">Current (edited)</option>}
            </select>
            <label htmlFor="mode-select" className="text-xs text-slate-300">Mode</label>
            <select id="mode-select" value={state.mode}
              onChange={(e) => setState((s) => ({ ...s, mode: e.target.value as LearningMode }))}
              className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
            <Btn onClick={reset} aria-label="Reset the lab to the default architecture">
              <span className="inline-flex items-center gap-1"><RotateCcw size={12} aria-hidden /> Reset</span>
            </Btn>
          </div>
        </div>
      </header>

      <nav aria-label="Lab sections" className="flex flex-wrap gap-2 mb-5">
        {LAB_TABS.map((t) => (
          <button key={t} onClick={() => navigate(t)} aria-current={tab === t ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors ${tab === t
              ? "border-sky-400 bg-sky-500/20 text-sky-200"
              : "border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {adrLog.length > 0 && (
        <div className="mb-4">
          <Callout kind="honest">
            <strong>Decision log:</strong> {adrLog[adrLog.length - 1]}
          </Callout>
        </div>
      )}

      <main>
        {tab === "intent" && (
          <IntentPanel onAdopt={(m) => {
            setModel(m);
            setState((st) => ({ ...st, archId: "custom" }));
          }} />
        )}
        {tab === "overview" && <OverviewPanel model={model} mode={state.mode} />}
        {tab === "causality" && <CausalityPanel model={model} />}
        {tab === "reasoning" && <ReasoningPanel model={model} />}
        {tab === "data" && <DataPanel model={model} />}
        {tab === "security" && <SecurityPanel model={model} />}
        {tab === "experiments" && (
          <ExperimentsPanel model={model}
            onAdoptModel={(m) => {
              setModel(m);
              setState((s) => ({ ...s, archId: "custom" }));
            }} />
        )}
        {tab === "review" && (
          <ReviewPanel model={model} mode={state.mode}
            onAddAdr={(text) => setAdrLog((log) => [...log, text])} />
        )}
        {tab === "capstone" && <CapstonePanel model={model} />}
      </main>

      <footer className="mt-8 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
        TRACEN Architecture Intelligence Lab (campaign 03). All simulations are deterministic educational models
        with declared assumptions — not production load tests. Progress and architectures stay in your browser.
      </footer>
    </div>
  );
};
