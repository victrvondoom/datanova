import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar, ViewType } from "./components/Sidebar";
import { VIEW_OPTIONS } from "./components/viewOptions";
import { MissionControl } from "./views/MissionControl";
import { TransactionStream } from "./views/TransactionStream";
import { FraudGraphView } from "./views/FraudGraphView";
import { DecisionLab } from "./views/DecisionLab";
import { BenchmarkLab } from "./views/BenchmarkLab";
import { DriftLab } from "./views/DriftLab";
import { ExplainabilityView } from "./views/ExplainabilityView";
import { ResearchCenter } from "./views/ResearchCenter";
import { TrailApp } from "./trail/TrailApp";
import { checkHealth } from "./api";

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  // Deep-link support: a fresh load (or navigation) to a #/trail/... URL
  // opens the TRACEN learning trail view directly.
  const [currentView, setCurrentViewState] = useState<ViewType>(() =>
    window.location.hash.startsWith("#/studio") ? "studio" : window.location.hash.startsWith("#/trail") ? "trail" : "mission"
  );
  // The trail and the Architecture Studio are one learning product with two
  // hash-routed areas; switching sidebar view keeps the URL in sync.
  const setCurrentView = (v: ViewType) => {
    if (v === "studio" && !window.location.hash.startsWith("#/studio")) window.location.hash = "#/studio";
    if (v === "trail" && !window.location.hash.startsWith("#/trail")) window.location.hash = "#/trail";
    setCurrentViewState(v);
  };
  // Rendered only on narrow screens (not merely CSS-hidden) so desktop DOM and selectors are unchanged.
  const [narrow, setNarrow] = useState<boolean>(() => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [online, setOnline] = useState<boolean>(false);
  const [showDeckModal, setShowDeckModal] = useState<boolean>(false);

  const checkConnection = () => {
    checkHealth().then((res) => {
      setOnline(res.status === "healthy");
    });
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash.startsWith("#/studio")) setCurrentViewState("studio");
      else if (window.location.hash.startsWith("#/trail")) setCurrentViewState("trail");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className={`min-h-screen ${darkMode ? "dark bg-navy-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      <div className="flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <Navbar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          online={online}
          onOpenDeck={() => setShowDeckModal(true)}
        />

        {/* Global degraded-state banner: no silent offline fallback */}
        {!online && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider">Backend offline</span>
              <span className="opacity-80">
                Views are showing offline fallback data (marked “degraded”), not live
                measurements. Scores, receipts, drift metrics, and savings figures in
                this mode are simulations. Receipt verification is unavailable offline
                and will not claim authenticity.
              </span>
            </div>
            <button
              onClick={checkConnection}
              className="shrink-0 px-3 py-1 rounded-lg font-bold bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
            >
              Retry connection
            </button>
          </div>
        )}

        {/* Small screens: the sidebar is hidden, so offer a compact view switcher */}
        {narrow && (
        <nav className="border-b border-slate-200 dark:border-navy-700 px-3 py-2" aria-label="Switch view">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            View
            <select
              className="flex-1 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value as ViewType)}
            >
              {VIEW_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </nav>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

          <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {currentView === "mission" && <MissionControl onNavigate={(v) => setCurrentView(v as ViewType)} />}
            {currentView === "stream" && <TransactionStream />}
            {currentView === "graph" && <FraudGraphView />}
            {currentView === "decision" && <DecisionLab />}
            {currentView === "benchmark" && <BenchmarkLab />}
            {currentView === "drift" && <DriftLab />}
            {currentView === "explain" && <ExplainabilityView />}
            {currentView === "research" && <ResearchCenter />}
            {(currentView === "trail" || currentView === "studio") && <TrailApp />}
          </main>
        </div>
      </div>

      {/* Presentation Deck Modal */}
      {showDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Finalist Presentation Deck (.pptx)
              </h3>
              <button
                onClick={() => setShowDeckModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              The full 12-slide executive presentation has been generated in your repository at:
            </p>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-navy-900 font-mono text-xs text-accent-teal break-all border border-slate-200 dark:border-navy-700">
              reports/AEGIS_Fraud_X_Finalist_Presentation.pptx
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>&bull; 16:9 Widescreen Layout formatted for competition evaluators.</div>
              <div>&bull; Every numerical claim is bound to <code>benchmarks/runs/benchmark_summary.json</code>.</div>
              <div>&bull; Covers architecture, graph heuristics, cost optimization, and responsible AI.</div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDeckModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-teal text-navy-900 hover:bg-accent-cyan transition-all"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
