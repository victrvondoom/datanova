import React from "react";
import { Shield, Sun, Moon, Download } from "lucide-react";
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
    <header className="sticky top-0 z-50 relative flex items-center justify-between px-6 py-3 border-b transition-colors bg-white dark:bg-navy-950 border-zinc-200/80 dark:border-white/10">
      {/* moa inheritance: flat header, single zinc hairline (no glass blur). */}

      {/* Brand & Problem Statement */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-meadow text-white ring-1 ring-black/5">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">
              AEGIS-Fraud <span className="ultra-shimmer-text">X</span>
            </span>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
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
