import React from "react";
import { Shield, Sun, Moon, Activity, Download, CheckCircle2 } from "lucide-react";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  online: boolean;
  onOpenDeck: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ darkMode, setDarkMode, online, onOpenDeck }) => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b backdrop-blur-md transition-colors bg-white/80 dark:bg-navy-900/80 border-slate-200 dark:border-navy-700">
      {/* Brand & Problem Statement */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-teal to-blue-600 shadow-md shadow-accent-teal/20 text-white">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              AEGIS-Fraud <span className="text-accent-teal">X</span>
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              DN-FN-01
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adaptive Graph-Enhanced Intelligence for Cost-Aware Financial Fraud Prevention
          </p>
        </div>
      </div>

      {/* Dataset & Live Engine Status */}
      <div className="flex items-center space-x-4">
        {/* Dataset Tag */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-accent-teal"></span>
          <span>EVALUATION: <strong className="text-slate-900 dark:text-white">SYNTHETIC 10K (SEED 42)</strong></span>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-500 font-semibold">ZERO LOOKAHEAD ENFORCED</span>
        </div>

        {/* Engine Connectivity */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-navy-700">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-500 radar-glow" : "bg-amber-500"}`} />
          <span className="text-slate-700 dark:text-slate-300">
            {online ? "Engine Active (FastAPI 8000)" : "Local Engine Mode"}
          </span>
        </div>

        {/* Presentation Deck Button */}
        <button
          onClick={onOpenDeck}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-accent-teal to-blue-600 hover:opacity-90 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Finalist PPTX</span>
        </button>

        {/* Dark/Light Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 border-slate-200 dark:border-navy-700 transition-colors"
          title="Toggle Theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
