import React from "react";
import { Shield, Sun, Moon, Download, Boxes } from "lucide-react";
import { fetchMetrics } from "../api";
import { useLive, formatUptime } from "../lib/useLive";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  online: boolean;
  onOpenDeck: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ darkMode, setDarkMode, online, onOpenDeck }) => {
  // Live engine telemetry (uptime + served-request counters), ticking every 15s.
  const metricsLive = useLive(fetchMetrics, 15_000);
  const metrics: any = metricsLive.data;

  return (
    <header className="sticky top-0 z-50 relative flex items-center justify-between px-6 py-3 border-b transition-colors bg-[#faf7f2]/95 dark:bg-[#181716]/95 border-[#e8e2d4] dark:border-[#2e2a24] backdrop-blur-md">
      {/* Brand & Problem Statement */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c59b27] via-[#a37d1d] to-[#181716] text-[#faf7f2] shadow-md shadow-[#c59b27]/25 ring-1 ring-[#c59b27]/40">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">
              AEGIS-Fraud <span className="font-cursive text-2xl text-[#b8860b] dark:text-[#dfba49] font-normal">X</span>
            </span>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-[#c59b27]/10 text-[#8f6d14] dark:text-[#dfba49] border border-[#c59b27]/30">
              DN-FN-01
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Adaptive Graph-Enhanced Intelligence for Cost-Aware Financial Fraud Prevention
          </p>
        </div>
      </div>

      {/* Dataset & Live Engine Status */}
      <div className="flex items-center space-x-4">
        {/* Dataset Tag */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium bg-white/60 dark:bg-navy-800/60 backdrop-blur-sm border-zinc-200/70 dark:border-navy-700/60 text-zinc-700 dark:text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-accent-teal"></span>
          <span>
            EVALUATION:{" "}
            <strong className="font-mono text-zinc-900 dark:text-white">SYNTHETIC 10K (SEED 42)</strong>
          </span>
          <span className="text-zinc-600 dark:text-zinc-300">|</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">ZERO LOOKAHEAD ENFORCED</span>
        </div>

        {/* Engine Connectivity */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium bg-white/60 dark:bg-navy-800/60 backdrop-blur-sm border-zinc-200/70 dark:border-navy-700/60">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-500 radar-glow" : "bg-amber-500"}`} />
          <span className="text-zinc-700 dark:text-zinc-300">
            {online
              ? `Engine Active${metrics?.uptime_seconds != null ? ` · up ${formatUptime(metrics.uptime_seconds)}` : ""}`
              : "Local Engine Mode"}
          </span>
        </div>

        {/* DataNova Unified Flagship Launcher */}
        <button
          onClick={() => { window.location.hash = "#/home"; }}
          className="flex items-center space-x-1.5 h-8 px-3 rounded-lg text-xs font-bold text-[#181716] dark:text-[#f5f2eb] bg-gradient-to-r from-[#dfba49] to-[#c59b27] dark:from-[#2e2a24] dark:to-[#1e1c19] hover:from-[#edd685] hover:to-[#dfba49] border border-[#c59b27]/40 transition-all shadow-sm shadow-[#c59b27]/20 active:scale-95"
          title="Open DataNova Flagship Studio"
        >
          <Boxes className="w-3.5 h-3.5 text-[#181716] dark:text-[#dfba49]" />
          <span>DataNova Studio</span>
        </button>

        {/* Presentation Deck Button */}
        <button
          onClick={onOpenDeck}
          className="flex items-center space-x-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Finalist PPTX</span>
        </button>

        {/* Dark/Light Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg border text-zinc-600 dark:text-zinc-300 bg-white/60 dark:bg-navy-800/60 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-navy-800 hover:border-accent-teal/40 border-zinc-200/70 dark:border-navy-700/60 transition-all"
          title="Toggle Theme"
          aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
        </button>
      </div>
    </header>
  );
};
