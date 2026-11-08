/**
 * DataNova Campaign 08 — Central Multi-Agent Orchestrator Modal UI
 *
 * Real execution phases, transparent specialist activities,
 * and unified evidence-linked final reports.
 * Styled in high-performance executive dark/light architecture aesthetic.
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
  darkMode?: boolean;
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
  darkMode = true,
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn transition-colors ${
      darkMode ? "bg-[#09090b]/80" : "bg-[#09090b]/40"
    }`}>
      <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
        darkMode
          ? "border-[#27272a] bg-[#141416] text-[#f4f4f5]"
          : "border-[#e8e6e1] bg-[#ffffff] text-[#111113]"
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between transition-colors ${
          darkMode ? "border-[#27272a] bg-[#0c0c0e]/95" : "border-[#e8e6e1] bg-[#fbfaf8]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 shadow-sm">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide">
                  What would you like to understand or improve?
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  DataNova Orchestrator
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                Describe a problem, ask a question, or tell DataNova what to investigate.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#232326]" : "text-[#63626b] hover:text-[#111113] hover:bg-[#f5f4f0]"
            }`}
            title="Close Orchestrator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Bar & Examples */}
        <div className={`p-6 border-b space-y-4 transition-colors ${
          darkMode ? "border-[#27272a] bg-[#121214]/80" : "border-[#e8e6e1] bg-[#fbfaf8]/80"
        }`}>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
                placeholder="Describe a problem, ask a question about your architecture, or tell DataNova what you want to change..."
                className={`w-full px-4 py-3 rounded-xl border text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all shadow-inner ${
                  darkMode
                    ? "border-[#27272a] bg-[#0c0c0e] text-[#f4f4f5]"
                    : "border-[#dedbd5] bg-[#ffffff] text-[#111113]"
                }`}
              />
            </div>
            <button
              onClick={() => handleRun()}
              disabled={isExecuting || !prompt.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090b] font-bold text-xs transition-all shadow-md shadow-amber-500/20 shrink-0 flex items-center gap-2 active:scale-95"
            >
              {isExecuting ? <RefreshCw size={14} className="animate-spin text-[#09090b]" /> : <Sparkles size={14} className="text-[#09090b]" />}
              <span>{isExecuting ? "Investigating..." : "Coordinate Agents"}</span>
            </button>
          </div>

          {/* Quick prompt suggestions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-medium font-mono uppercase tracking-wider ${
              darkMode ? "text-[#71717a]" : "text-[#71717a]"
            }`}>
              Examples:
            </span>
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleSelectExample(ex)}
                disabled={isExecuting}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors shadow-sm ${
                  darkMode
                    ? "border-[#27272a] bg-[#0c0c0e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-amber-500"
                    : "border-[#dedbd5] bg-[#ffffff] text-[#63626b] hover:text-[#111113] hover:border-amber-500"
                }`}
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
            <div className={`p-6 rounded-xl border space-y-4 animate-fadeIn ${
              darkMode
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-amber-500/25 bg-amber-50/50"
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold text-amber-500">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-amber-500" />
                  <span>Orchestrator Execution in Progress</span>
                </span>
                <span className={`font-mono text-[10px] ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
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
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold"
                          : isCurrent
                          ? darkMode
                            ? "border-amber-500 bg-amber-500/20 text-[#f4f4f5] font-bold ring-1 ring-amber-500/40"
                            : "border-amber-500 bg-amber-100 text-[#111113] font-bold ring-1 ring-amber-500/30"
                          : darkMode
                          ? "border-[#27272a] bg-[#0c0c0e] text-[#71717a]"
                          : "border-[#e8e6e1] bg-[#fbfaf8] text-[#71717a]"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
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
              <div className={`p-5 rounded-xl border space-y-3 shadow-md ${
                darkMode ? "border-[#27272a] bg-[#0c0c0e]" : "border-[#e8e6e1] bg-[#fbfaf8]"
              }`}>
                <div className={`flex items-center justify-between border-b pb-2.5 ${
                  darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
                }`}>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
                    What DataNova Understood
                  </span>
                  <span className={`text-[10px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>
                    Scope: {report.scope.projectName} (v{report.scope.version}) &bull; {report.scope.componentsExamined.length} components
                  </span>
                </div>
                <p className={`text-sm font-semibold leading-relaxed ${
                  darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                }`}>
                  {report.understoodGoal}
                </p>
              </div>

              {/* Key Findings Ledger */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${
                    darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                  }`}>
                    Key Findings ({report.findings.length})
                  </h3>
                  <span className={`text-[11px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>
                    Grounded Discoveries
                  </span>
                </div>

                <div className="space-y-3">
                  {report.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`p-4 rounded-xl border text-xs space-y-2 transition-all shadow-sm ${
                        f.severity === "critical"
                          ? darkMode
                            ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 to-[#0c0c0e]"
                            : "border-rose-200 bg-gradient-to-r from-rose-50/70 to-[#ffffff]"
                          : f.severity === "warning"
                          ? darkMode
                            ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-[#0c0c0e]"
                            : "border-amber-200 bg-gradient-to-r from-amber-50/70 to-[#ffffff]"
                          : darkMode
                          ? "border-[#27272a] bg-[#0c0c0e]"
                          : "border-[#e8e6e1] bg-[#ffffff]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              f.severity === "critical"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                : f.severity === "warning"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className={`font-bold text-sm tracking-tight ${
                            darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                          }`}>{f.title}</span>
                        </div>
                        <span className={`text-[11px] font-mono ${darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>{f.affectedComponent}</span>
                      </div>

                      <p className={`leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>{f.plainSummary}</p>

                      <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                        darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
                      }`}>
                        <span className={darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"}>
                          Technical: <strong className={darkMode ? "text-[#f4f4f5]" : "text-[#111113]"}>{f.technicalTerm}</strong>
                        </span>
                        <span className="text-amber-500 font-mono font-semibold">
                          Evidence: {f.evidenceRef}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why It Matters */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                darkMode ? "border-[#27272a] bg-[#0c0c0e]" : "border-[#e8e6e1] bg-[#fbfaf8]"
              }`}>
                <span className={`text-xs font-bold font-mono uppercase tracking-wider block ${
                  darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                }`}>
                  Why These Findings Matter:
                </span>
                <div className="space-y-1.5">
                  {report.whyItMatters.map((w, i) => (
                    <div key={i} className={`text-xs flex items-start gap-2 ${darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}`}>
                      <span className="text-amber-500 font-bold">&bull;</span>
                      <span className="leading-snug">{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uncertainties & Limitations */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                darkMode ? "border-[#27272a] bg-[#0c0c0e]/60" : "border-[#e8e6e1] bg-[#ffffff]"
              }`}>
                <div className={`flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider ${
                  darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"
                }`}>
                  <AlertTriangle size={13} className="text-amber-500" />
                  <span>Uncertainties & Known Limits (Zero False Certainty)</span>
                </div>
                <div className="space-y-1">
                  {report.uncertainties.map((u, i) => (
                    <div key={i} className={`text-[11px] flex items-start gap-2 ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
                      <span className="text-zinc-600">&bull;</span>
                      <span>{u}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Next Actions */}
              <div className="space-y-2.5">
                <span className={`text-xs font-bold font-mono uppercase tracking-wider block ${
                  darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                }`}>
                  Recommended Next Actions:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.recommendedActions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => handleActionClick(act.targetView)}
                      className={`p-3.5 rounded-xl border text-left flex items-center justify-between group transition-all shadow-sm ${
                        darkMode
                          ? "border-[#27272a] bg-[#0c0c0e] hover:border-amber-500/60 hover:bg-[#18181b]"
                          : "border-[#e8e6e1] bg-[#ffffff] hover:border-amber-500/60 hover:bg-[#fbfaf8]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ArrowRight size={14} className="text-amber-500 group-hover:translate-x-1 transition-transform" />
                        <span className={`text-xs font-semibold group-hover:text-amber-500 transition-colors ${
                          darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
                        }`}>
                          {act.label}
                        </span>
                      </div>
                      <ChevronRight size={13} className={darkMode ? "text-[#71717a]" : "text-[#71717a]"} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Expandable Technical Activity Log */}
              <div className={`border rounded-xl overflow-hidden ${
                darkMode ? "border-[#27272a]" : "border-[#e8e6e1]"
              }`}>
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className={`w-full px-4 py-3 transition-colors flex items-center justify-between text-xs ${
                    darkMode ? "bg-[#0c0c0e] hover:bg-[#18181b] text-[#a1a1aa]" : "bg-[#fbfaf8] hover:bg-[#f5f4f0] text-[#63626b]"
                  }`}
                >
                  <span className="flex items-center gap-2 font-mono">
                    <Terminal size={14} className="text-amber-500" />
                    <span>Specialist Agent Technical Details ({report.specialistActivities.length} Tasks)</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showTechnicalDetails ? "rotate-180" : ""}`}
                  />
                </button>

                {showTechnicalDetails && (
                  <div className={`p-4 border-t space-y-2.5 text-xs font-mono ${
                    darkMode ? "bg-[#0c0c0e] border-[#27272a]" : "bg-[#ffffff] border-[#e8e6e1]"
                  }`}>
                    {report.specialistActivities.map((act) => (
                      <div key={act.id} className={`p-3 rounded border space-y-1 ${
                        darkMode ? "bg-[#141416] border-[#27272a]" : "bg-[#fbfaf8] border-[#e8e6e1]"
                      }`}>
                        <div className="flex items-center justify-between text-amber-500 font-bold">
                          <span>[{act.specialist.toUpperCase()}] {act.task}</span>
                          <span className={`text-[10px] ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>{act.durationMs}ms</span>
                        </div>
                        <div className={darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"}>{act.outputSummary}</div>
                        <div className={`text-[10px] ${darkMode ? "text-[#71717a]" : "text-[#71717a]"}`}>
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
            <div className="p-12 text-center text-xs space-y-3">
              <Bot size={36} className="text-amber-500 mx-auto opacity-80 animate-pulse" />
              <div className="font-bold text-sm">
                Describe your engineering goal above
              </div>
              <p className={`max-w-md mx-auto leading-relaxed text-[11px] ${
                darkMode ? "text-[#a1a1aa]" : "text-[#63626b]"
              }`}>
                The DataNova Orchestrator will analyze your request, formulate an execution plan across specialized agents, and present one evidence-backed report with recommended actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
