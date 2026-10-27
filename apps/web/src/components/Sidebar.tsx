import React from "react";
import {
  LayoutDashboard,
  PlayCircle,
  Network,
  Sliders,
  BarChart3,
  Activity,
  FileCheck2,
  BookOpenCheck,
} from "lucide-react";

export type ViewType =
  | "mission"
  | "stream"
  | "graph"
  | "decision"
  | "benchmark"
  | "drift"
  | "explain"
  | "research";

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    { id: "mission" as ViewType, label: "Mission Control", icon: LayoutDashboard, badge: "Live KPIs" },
    { id: "stream" as ViewType, label: "Live Digital Twin", icon: PlayCircle, badge: "Replay" },
    { id: "graph" as ViewType, label: "Fraud Network Graph", icon: Network, badge: "Mule Rings" },
    { id: "decision" as ViewType, label: "Decision Intelligence", icon: Sliders, badge: "Cost Engine" },
    { id: "benchmark" as ViewType, label: "ML Benchmarks", icon: BarChart3, badge: "6 Models" },
    { id: "drift" as ViewType, label: "Drift & Stress Lab", icon: Activity, badge: "PSI Alert" },
    { id: "explain" as ViewType, label: "Explainability Explorer", icon: FileCheck2, badge: "TreeSHAP" },
    { id: "research" as ViewType, label: "Evidence & Research", icon: BookOpenCheck, badge: "Artifacts" },
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

      {/* Champion Status Card */}
      <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-navy-800/60 border-slate-200 dark:border-navy-700">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
          Active Champion
        </div>
        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
          AEGIS LightGBM + Graph
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-navy-700 text-[11px]">
          <span className="text-slate-500">PR-AUC:</span>
          <span className="font-bold text-emerald-500">0.8004</span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <span className="text-slate-500">Latency:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">&lt; 0.02 ms</span>
        </div>
      </div>
    </aside>
  );
};
