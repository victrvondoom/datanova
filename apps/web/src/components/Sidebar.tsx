import React, { useEffect, useState } from "react";
import { checkHealth, fetchBenchmarks } from "../api";
import { useCountUp } from "../lib/useCountUp";
import { formatKpiValue, staggerDelayMs } from "../lib/ultra";
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
  Trophy,
  Radio,
  WifiOff,
} from "lucide-react";

export type ViewType =
  | "datanova"
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

  // Dynamic benchmark badge: the real number of models in the current
  // benchmark artifacts (falls back to a neutral label while loading).
  const [modelCount, setModelCount] = useState<number | null>(null);

  // Animated KPI presentation of the API-provided champion metrics.
  const animatedPrAuc = useCountUp(champion.prAuc ?? 0, { durationMs: 1200 });
  const animatedLatency = useCountUp(champion.latencyMs ?? 0, { durationMs: 1200 });

  useEffect(() => {
    let cancelled = false;
    const refreshChampion = async () => {
      try {
        const [health, benchmarks] = await Promise.all([checkHealth(), fetchBenchmarks()]);
        if (cancelled) return;
        const champ = (benchmarks as any).benchmark_summary?.["XGBoost"];
        const summary = (benchmarks as any).benchmark_summary ?? {};
        setModelCount(Object.keys(summary).length || null);
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
    { id: "datanova" as ViewType, label: "DataNova Unified", icon: Boxes, badge: "Flagship" },
    { id: "mission" as ViewType, label: "Mission Control", icon: LayoutDashboard, badge: "Live KPIs" },
    // modelCount badge derives from the live benchmark payload.
    { id: "stream" as ViewType, label: "Live Digital Twin", icon: PlayCircle, badge: "Replay" },
    { id: "graph" as ViewType, label: "Fraud Network Graph", icon: Network, badge: "Mule Rings" },
    { id: "decision" as ViewType, label: "Decision Intelligence", icon: Sliders, badge: "Cost Engine" },
    { id: "benchmark" as ViewType, label: "ML Benchmarks", icon: BarChart3, badge: modelCount ? `${modelCount} Models` : "Artifacts" },
    { id: "drift" as ViewType, label: "Drift & Stress Lab", icon: Activity, badge: "PSI Alert" },
    { id: "explain" as ViewType, label: "Explainability Explorer", icon: FileCheck2, badge: "TreeSHAP" },
    { id: "research" as ViewType, label: "Evidence & Research", icon: BookOpenCheck, badge: "Artifacts" },
    { id: "trail" as ViewType, label: "Vibe Coding Trail", icon: GraduationCap, badge: `${trailCompleted}/20 done` },
    { id: "lab" as ViewType, label: "Architecture Lab", icon: FlaskConical, badge: "Campaign 03" },
    { id: "atlas" as ViewType, label: "Datanova Atlas", icon: Boxes, badge: "Spatial Studio" },
  ];

  return (
    <aside className="w-64 border-r flex flex-col justify-between p-4 bg-[#faf7f2] dark:bg-[#181716] border-[#e8e2d4] dark:border-[#2e2a24] transition-colors">
      <div className="space-y-1.5 ultra-stagger">
        <div className="px-3 py-2 text-[11px] font-display font-bold tracking-wider uppercase text-[#6e675f] dark:text-[#a69f93]">
          Core Laboratories
        </div>

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                if (item.id === "datanova") {
                  window.location.hash = "#/home";
                }
              }}
              style={{ animationDelay: `${staggerDelayMs(index + 1)}ms` }}
              className={`relative w-full flex items-center justify-between h-9 px-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-[#181716] text-[#faf7f2] dark:bg-[#282520] dark:text-[#dfba49] shadow-sm font-semibold"
                  : "text-[#575249] hover:bg-[#ede5d5] hover:text-[#181716] dark:text-[#a69f93] dark:hover:bg-[#22201d] dark:hover:text-[#f5f2eb]"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#c59b27]"
                />
              )}
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-[#c59b27] dark:text-[#dfba49]" : "text-[#78716c] dark:text-[#8c857b]"}`} />
                <span>{item.label}</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  isActive
                    ? "bg-[#c59b27]/20 text-[#181716] dark:text-[#dfba49] font-semibold"
                    : "bg-[#ece3d3] dark:bg-[#22201d] text-[#78716c] dark:text-[#8c857b]"
                }`}
              >
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Champion Status Card — live from the API (honest when offline) */}
      <div className="ultra-card ultra-crown p-3.5 mt-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1.5">
            <Trophy className="w-3.5 h-3.5 text-cyan-700 dark:text-accent-teal" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Active Champion
            </span>
          </div>
          <span
            className={`flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
              champion.online
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
            }`}
          >
            {champion.online ? (
              <Radio className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span>{champion.online ? "Live" : "Offline"}</span>
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate">
          {champion.modelId ?? "backend offline"}
        </div>
        {champion.artifactStatus && (
          <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 truncate">
            artifact: {champion.artifactStatus}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200/70 dark:border-navy-700/70 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-300">PR-AUC:</span>
          <span className={`font-mono font-bold ${champion.degraded ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {champion.prAuc !== null ? formatKpiValue(animatedPrAuc, { decimals: 4 }) : "—"}
            {champion.degraded ? " (cached)" : ""}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <span className="text-zinc-600 dark:text-zinc-300">Latency:</span>
          <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
            {champion.latencyMs !== null
              ? `${formatKpiValue(animatedLatency, {
                  decimals: Number.isInteger(champion.latencyMs) ? 0 : 2,
                })} ms/tx`
              : "—"}
          </span>
        </div>
      </div>
    </aside>
  );
};
