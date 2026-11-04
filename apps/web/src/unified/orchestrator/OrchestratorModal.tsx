/**
 * DataNova Campaign 08 — Central Multi-Agent Orchestrator Modal UI
 *
 * Real execution phases, transparent specialist activities,
 * and unified evidence-linked final reports.
 */

import React, { useState } from "react";
import {
  Sparkles, Bot, CheckCircle2, ChevronRight, X, AlertTriangle,
  ArrowRight, RefreshCw, Terminal, ChevronDown
} from "lucide-react";
import type { OrchestrationReport } from "../types";
import { DataNovaOrchestratorEngine } from "./orchestratorEngine";
import type { ArchitectureModel } from "../../lab/model";

interface OrchestratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ArchitectureModel;
  projectName?: string;
  projectVersion?: number;
  initialPrompt?: string;
  onNavigate: (view: string) => void;
}

const EXAMPLE_PROMPTS = [
  "Find undocumented dependencies in this system",
  "Investigate why checkout requests are slow",
  "Check whether this architecture has a security-boundary problem",
  "Compare the current design with this proposed change",
  "Review the evidence for this architecture",
];

const EXECUTION_STEPS = [
  { id: "1", label: "Understanding your request" },
  { id: "2", label: "Preparing the investigation plan" },
  { id: "3", label: "Coordinating specialist agents" },
  { id: "4", label: "Collecting supporting telemetry & evidence" },
  { id: "5", label: "Checking findings & verifying model" },
  { id: "6", label: "Preparing unified report" },
];

export const OrchestratorModal: React.FC<OrchestratorModalProps> = ({
  isOpen,
  onClose,
  model,
  projectName = "DocFlow Architecture",
  projectVersion = 1,
  initialPrompt = "",
  onNavigate,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [report, setReport] = useState<OrchestrationReport | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const engine = React.useMemo(() => new DataNovaOrchestratorEngine(), []);

  if (!isOpen) return null;

  const handleRun = async (selectedPrompt?: string) => {
    const textToRun = selectedPrompt || prompt;
    if (!textToRun.trim()) return;

    setIsExecuting(true);
    setReport(null);
    setCurrentStepIndex(0);

    // Simulate real execution phase progression
    for (let i = 0; i < EXECUTION_STEPS.length; i++) {
      setCurrentStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const res = engine.execute(textToRun, model, projectName, projectVersion);
    setReport(res);
    setIsExecuting(false);
  };

  const handleSelectExample = (ex: string) => {
    setPrompt(ex);
    handleRun(ex);
  };

  const handleActionClick = (targetView?: string) => {
    if (targetView) {
      onNavigate(targetView);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/30 border border-sky-500/40 text-sky-400">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  What would you like to understand or improve?
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  DataNova Orchestrator
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Describe a problem, ask a question, or tell DataNova what to investigate.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Orchestrator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Bar & Examples */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/40 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
                placeholder="Describe a problem, ask a question about your architecture, or tell DataNova what you want to change..."
                className="w-full px-4 py-3 rounded-xl border border-slate-700/80 bg-slate-950 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans shadow-inner"
              />
            </div>
            <button
              onClick={() => handleRun()}
              disabled={isExecuting || !prompt.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 shrink-0 flex items-center gap-2"
            >
              {isExecuting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{isExecuting ? "Investigating..." : "Coordinate Agents"}</span>
            </button>
          </div>

          {/* Quick prompt suggestions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">Examples:</span>
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleSelectExample(ex)}
                disabled={isExecuting}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-sky-300 hover:border-slate-700 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Real Execution Steps Display */}
          {isExecuting && (
            <div className="p-6 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-sky-400" />
                  <span>Orchestrator Execution in Progress</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Step {currentStepIndex + 1} of {EXECUTION_STEPS.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXECUTION_STEPS.map((s, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={s.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        isDone
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : isCurrent
                          ? "border-sky-500/60 bg-sky-500/20 text-white font-bold ring-1 ring-sky-500/30"
                          : "border-slate-800 bg-slate-950/60 text-slate-500"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                      )}
                      <span className="truncate text-[11px]">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified Final Report */}
          {report && !isExecuting && (
            <div className="space-y-6 animate-fadeIn">
              {/* Executive Summary Card */}
              <div className="p-5 rounded-xl border border-slate-800/90 bg-slate-950/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400">
                    What DataNova Understood
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Scope: {report.scope.projectName} (v{report.scope.version}) &bull; {report.scope.componentsExamined.length} components
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                  {report.understoodGoal}
                </p>
              </div>

              {/* Key Findings Ledger */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Key Findings ({report.findings.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">Evidence-linked discoveries</span>
                </div>

                <div className="space-y-3">
                  {report.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
                        f.severity === "critical"
                          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 to-slate-950"
                          : f.severity === "warning"
                          ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-slate-950"
                          : "border-sky-500/40 bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              f.severity === "critical"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : f.severity === "warning"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-bold text-white text-sm tracking-tight">{f.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{f.affectedComponent}</span>
                      </div>

                      <p className="text-slate-300 leading-relaxed">{f.plainSummary}</p>

                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400">
                          Technical term: <strong className="text-slate-300">{f.technicalTerm}</strong>
                        </span>
                        <span className="text-sky-300 font-mono">
                          Evidence: {f.evidenceRef}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why It Matters */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <span className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider block">
                  Why These Findings Matter:
                </span>
                <div className="space-y-1.5">
                  {report.whyItMatters.map((w, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">&bull;</span>
                      <span className="leading-snug">{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uncertainties & Limitations */}
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span>Uncertainties & Known Limits (Zero False Certainty)</span>
                </div>
                <div className="space-y-1">
                  {report.uncertainties.map((u, i) => (
                    <div key={i} className="text-[11px] text-slate-400 flex items-start gap-2">
                      <span className="text-slate-600">&bull;</span>
                      <span>{u}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Next Actions */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider block">
                  Recommended Next Actions:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.recommendedActions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => handleActionClick(act.targetView)}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:border-sky-500/60 hover:bg-slate-900 transition-all text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <ArrowRight size={14} className="text-sky-400 group-hover:translate-x-1 transition-transform" />
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                          {act.label}
                        </span>
                      </div>
                      <ChevronRight size={13} className="text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Expandable Technical Activity Log */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full px-4 py-3 bg-slate-950/80 hover:bg-slate-900 transition-colors flex items-center justify-between text-xs text-slate-400"
                >
                  <span className="flex items-center gap-2 font-mono">
                    <Terminal size={14} className="text-sky-400" />
                    <span>Specialist Agent Technical Details ({report.specialistActivities.length} Tasks)</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showTechnicalDetails ? "rotate-180" : ""}`}
                  />
                </button>

                {showTechnicalDetails && (
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-2.5 text-xs font-mono">
                    {report.specialistActivities.map((act) => (
                      <div key={act.id} className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-sky-300 font-bold">
                          <span>[{act.specialist.toUpperCase()}] {act.task}</span>
                          <span className="text-slate-500 text-[10px]">{act.durationMs}ms</span>
                        </div>
                        <div className="text-slate-300 text-[11px]">{act.outputSummary}</div>
                        <div className="text-[10px] text-slate-500">
                          Evidence: {act.evidenceRefs.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty / Initial state when opened without prompt */}
          {!report && !isExecuting && (
            <div className="p-12 text-center text-xs text-slate-400 space-y-3">
              <Bot size={36} className="text-slate-600 mx-auto" />
              <div className="font-bold text-slate-200 text-sm">
                Describe your engineering goal above
              </div>
              <p className="max-w-md mx-auto text-slate-500 leading-relaxed text-[11px]">
                The DataNova Orchestrator will analyze your request, formulate an execution plan across specialized agents, and present one evidence-backed report with recommended actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
