import React, { useState, useEffect, Suspense } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar, ViewType } from "./components/Sidebar";
import { MissionControl } from "./views/MissionControl";
import { TransactionStream } from "./views/TransactionStream";
import { FraudGraphView } from "./views/FraudGraphView";
import { DecisionLab } from "./views/DecisionLab";
import { BenchmarkLab } from "./views/BenchmarkLab";
import { DriftLab } from "./views/DriftLab";
import { ExplainabilityView } from "./views/ExplainabilityView";
import { ResearchCenter } from "./views/ResearchCenter";
import { checkHealth } from "./api";
// Heavy standalone products are code-split: three.js (atlas), the lab and the
// trail only load when their view is opened or deep-linked.
const TrailApp = React.lazy(() => import("./trail/TrailApp").then((m) => ({ default: m.TrailApp })));
const LabApp = React.lazy(() => import("./lab/LabApp").then((m) => ({ default: m.LabApp })));
const AtlasApp = React.lazy(() => import("./atlas/AtlasApp").then((m) => ({ default: m.AtlasApp })));

const ViewSuspense: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
      <div className="w-8 h-8 rounded-full border-2 border-accent-teal/30 border-t-accent-teal animate-spin" />
      <span className="text-xs font-semibold uppercase tracking-widest">Loading module…</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  // Deep-link support: a fresh load (or navigation) to a #/trail/... URL
  // opens the TRACEN learning trail view directly.
  const [currentView, setCurrentView] = useState<ViewType>(() =>
    window.location.hash.startsWith("#/trail") ? "trail"
      : window.location.hash.startsWith("#/lab") ? "lab"
        : window.location.hash.startsWith("#/atlas") ? "atlas"
          : "mission"
  );
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
      if (window.location.hash.startsWith("#/trail")) {
        setCurrentView("trail");
      }
      if (window.location.hash.startsWith("#/lab")) {
        setCurrentView("lab");
      }
      if (window.location.hash.startsWith("#/atlas")) {
        setCurrentView("atlas");
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className={`min-h-screen ${darkMode ? "dark bg-navy-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      {/* Ultra-mode aurora canvas: fixed, behind all content (dark theme only).
          Scoped to the ops dashboard — the trail/lab/atlas products have their
          own visual design (and pixel baselines) and stay untouched. */}
      {!["trail", "lab", "atlas"].includes(currentView) && (
        <div className="ultra-aurora" aria-hidden="true" />
      )}
      <div className="relative z-10 flex flex-col min-h-screen">
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

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

          <main className={currentView === "atlas" ? "flex-1 overflow-hidden w-full" : "flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full"}>
            {currentView === "mission" && <MissionControl onNavigate={(v) => setCurrentView(v as ViewType)} />}
            {currentView === "stream" && <TransactionStream />}
            {currentView === "graph" && <FraudGraphView />}
            {currentView === "decision" && <DecisionLab />}
            {currentView === "benchmark" && <BenchmarkLab />}
            {currentView === "drift" && <DriftLab />}
            {currentView === "explain" && <ExplainabilityView />}
            {currentView === "research" && <ResearchCenter />}
            {currentView === "trail" && <Suspense fallback={<ViewSuspense />}><TrailApp /></Suspense>}
          {currentView === "lab" && <Suspense fallback={<ViewSuspense />}><LabApp /></Suspense>}
          {currentView === "atlas" && <div className="flex-1 overflow-hidden !p-0 !m-0 !max-w-none"><Suspense fallback={<ViewSuspense />}><AtlasApp /></Suspense></div>}
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
