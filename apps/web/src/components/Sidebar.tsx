import React, { useEffect, useState } from "react";
import { checkHealth, fetchBenchmarks } from "../api";
import {
  LayoutDashboard,
  PlayCircle,
  Network,
  Sliders,
  BarChart3,
  Activity,
  FileCheck2,
  BookOpenCheck,
  GraduationCap,
  FlaskConical,
  Boxes,
} from "lucide-react";

export type ViewType =
  | "mission"
  | "stream"
  | "graph"
  | "decision"
  | "benchmark"
  | "drift"
  | "explain"
  | "research"
  | "trail"
  | "lab"
  | "atlas";

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

interface ChampionStatus {
  online: boolean;
  modelId: string | null;
  artifactStatus: string | null;
  prAuc: number | null;
  latencyMs: number | null;
  degraded: boolean;
}

const OFFLINE_STATUS: ChampionStatus = {
  online: false,
  modelId: null,
  artifactStatus: null,
  prAuc: null,
  latencyMs: null,
  degraded: false,
};

function readTrailCompleted(): number {
  try {
    const raw = window.localStorage.getItem("tracen-trail-progress-v1");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.completed) ? parsed.completed.length : 0;
  } catch {
    return 0;
  }
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  // Live champion status: from the real API when reachable, honestly marked
  // as a cached snapshot when offline. Refreshed periodically and on regaining focus.
  const [champion, setChampion] = useState<ChampionStatus>(OFFLINE_STATUS);

  // Dynamic trail badge: reflects real learning progress in localStorage.
  const [trailCompleted, setTrailCompleted] = useState<number>(() => readTrailCompleted());

  useEffect(() => {
    let cancelled = false;
    const refreshChampion = async () => {
      try {
        const [health, benchmarks] = await Promise.all([checkHealth(), fetchBenchmarks()]);
        if (cancelled) return;
        const champ = (benchmarks as any).benchmark_summary?.["XGBoost"];
        setChampion({
          online: health?.status === "healthy",
          modelId: health?.model_id ?? null,
          artifactStatus: health?.artifact_status ?? null,
          prAuc: champ?.pr_auc ?? null,
          latencyMs: champ?.inference_latency_ms_per_tx ?? null,
          degraded: benchmarks?.degraded === true,
        });
      } catch {
        if (!cancelled) setChampion(OFFLINE_STATUS);
      }
    };
    void refreshChampion();
    const interval = window.setInterval(refreshChampion, 30_000);
    const onFocus = () => void refreshChampion();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const sync = () => setTrailCompleted(readTrailCompleted());
    window.addEventListener("hashchange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const navItems = [
    { id: "mission" as ViewType, label: "Mission Control", icon: LayoutDashboard, badge: "Live KPIs" },
    { id: "stream" as ViewType, label: "Live Digital Twin", icon: PlayCircle, badge: "Replay" },
    { id: "graph" as ViewType, label: "Fraud Network Graph", icon: Network, badge: "Mule Rings" },
    { id: "decision" as ViewType, label: "Decision Intelligence", icon: Sliders, badge: "Cost Engine" },
    { id: "benchmark" as ViewType, label: "ML Benchmarks", icon: BarChart3, badge: "6 Models" },
    { id: "drift" as ViewType, label: "Drift & Stress Lab", icon: Activity, badge: "PSI Alert" },
    { id: "explain" as ViewType, label: "Explainability Explorer", icon: FileCheck2, badge: "TreeSHAP" },
    { id: "research" as ViewType, label: "Evidence & Research", icon: BookOpenCheck, badge: "Artifacts" },
    { id: "trail" as ViewType, label: "Vibe Coding Trail", icon: GraduationCap, badge: `${trailCompleted}/20 done` },
    { id: "lab" as ViewType, label: "Architecture Lab", icon: FlaskConical, badge: "Campaign 03" },
    { id: "atlas" as ViewType, label: "Datanova Atlas", icon: Boxes, badge: "Spatial Studio" },
  ];

  return (
    <aside className="w-64 border-r flex flex-col justify-between p-4 bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 transition-colors">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
          Core Laboratories
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent-teal/10 text-accent-teal border border-accent-teal/30 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-accent-teal" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md ${
                  isActive
                    ? "bg-accent-teal text-navy-900 font-bold"
                    : "bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Champion Status Card — live from the API (honest when offline) */}
      <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-navy-800/60 border-slate-200 dark:border-navy-700">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
          Active Champion
        </div>
        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
          {champion.modelId ?? "backend offline"}
        </div>
        {champion.artifactStatus && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            artifact: {champion.artifactStatus}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-navy-700 text-[11px]">
          <span className="text-slate-500">PR-AUC:</span>
          <span className={`font-bold ${champion.degraded ? "text-amber-500" : "text-emerald-500"}`}>
            {champion.prAuc !== null ? champion.prAuc.toFixed(4) : "—"}
            {champion.degraded ? " (cached)" : ""}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <span className="text-slate-500">Latency:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {champion.latencyMs !== null ? `${champion.latencyMs} ms/tx` : "—"}
          </span>
        </div>
      </div>
    </aside>
  );
};
