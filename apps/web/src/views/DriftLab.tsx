import React, { useState, useEffect } from "react";
import { Activity, AlertTriangle, ShieldCheck, Zap, RefreshCw, AlertCircle, Move } from "lucide-react";
import { evaluateDrift, simulateStress } from "../api";
import { useCountUp } from "../lib/useCountUp";

/** Mono metric that counts up and draws its gradient underline once mounted. */
const AnimatedMetric: React.FC<{
  value: number;
  format: (v: number) => string;
  className?: string;
}> = ({ value, format, className = "" }) => {
  const animated = useCountUp(value, { durationMs: 1300 });
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 90);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span className={`ultra-metric ${drawn ? "ultra-metric-drawn" : ""} ${className}`.trim()}>
      {format(animated)}
    </span>
  );
};

/** PSI gauge on the documented 0 → 0.25 significant-drift scale; animates in after mount. */
const PsiGauge: React.FC<{ psi: number }> = ({ psi }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), 180);
    return () => window.clearTimeout(t);
  }, [psi]);
  const pct = Math.max(0, Math.min(100, (psi / 0.25) * 100));
  return (
    <div className="relative h-1.5 ultra-progress-track">
      <div
        className="ultra-progress-fill"
        style={{ width: `${on ? pct : 0}%` }}
      />
      {/* 0.10 moderate-shift threshold tick (40% of the 0.25 scale) */}
      <div className="absolute -top-0.5 left-[40%] w-px h-2.5 bg-slate-400/60 dark:bg-slate-500/60" />
    </div>
  );
};

/** Alert-level chip: icon + mono label so severity is never color alone. */
const AlertLevelChip: React.FC<{ level: string }> = ({ level }) => {
  const tone =
    level === "GREEN"
      ? "text-emerald-500"
      : level === "AMBER"
      ? "text-amber-500"
      : "text-rose-500";
  const Icon = level === "GREEN" ? ShieldCheck : level === "AMBER" ? AlertTriangle : AlertCircle;
  return (
    <span className={`ultra-chip ${tone}`}>
      <Icon className="w-3 h-3" />
      <span className="font-mono font-bold">{level}</span>
    </span>
  );
};

export const DriftLab: React.FC = () => {
  const [driftReport, setDriftReport] = useState<any>({
    status: "STABLE",
    amount_psi: 0.0342,
    amount_wasserstein_distance: 14.82,
    alert_level: "GREEN",
    scenario: "none",
    scenario_description: "Clean Baseline Stationary Stream",
    action_required: false,
    recommendation: "System stationary. Normal operational thresholds active.",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string>("none");

  const runDriftCheck = async () => {
    setLoading(true);
    try {
      const res = await evaluateDrift();
      setDriftReport(res);
      setActiveScenario("none");
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // deferred off the render commit (avoids cascading setState in the
    // effect body)
    const t = window.setTimeout(() => runDriftCheck(), 0);
    return () => window.clearTimeout(t);
  }, []);

  const handleTriggerStress = async (scenario: "smurfing" | "spoofing" | "none") => {
    setActiveScenario(scenario);
    setLoading(true);
    try {
      const res = await simulateStress(scenario);
      setDriftReport(res);
    } catch (e: any) {
      alert("Stress simulation error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const psiValue = typeof driftReport.amount_psi === "number" ? driftReport.amount_psi : 0.0342;
  const wassersteinValue =
    typeof driftReport.amount_wasserstein_distance === "number"
      ? driftReport.amount_wasserstein_distance
      : 14.82;

  return (
    <div className="space-y-6 ultra-stagger">
      {/* Header */}
      <div className="ultra-card ultra-crown p-5 overflow-hidden">
        <div className="ultra-grid-overlay absolute inset-0 pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <Activity className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                Concept Shift &amp; Adversarial Robustness
              </span>
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-1">
              Fraud Drift &amp; <span className="ultra-shimmer-text">Stress Testing Laboratory</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Continuous Population Stability Index (PSI) and Wasserstein Distance monitoring across sliding transaction windows.
            </p>
          </div>

          <button
            onClick={runDriftCheck}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent-teal" : ""}`} />
            <span>{loading ? "Evaluating..." : "Run Stationary Baseline Check"}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 ultra-stagger">
        {/* PSI Metric */}
        <div className="ultra-card ultra-crown ultra-gradient-ring p-5 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Population Stability Index (PSI)</span>
            <AlertLevelChip level={driftReport.alert_level} />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
            <AnimatedMetric value={psiValue} format={(v) => v.toFixed(4)} />
          </div>
          <PsiGauge psi={psiValue} />
          <p className="text-[11px] text-slate-400">
            Threshold: PSI &lt; 0.10 Stable | 0.10 - 0.25 Moderate | &ge; 0.25 Significant
          </p>
        </div>

        {/* Wasserstein Distance */}
        <div className="ultra-card ultra-crown p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Wasserstein Distance ($W_1$)</span>
            <span className="ultra-chip text-accent-teal">
              <Move className="w-3 h-3" />
              <span className="font-mono font-bold">Earth Mover</span>
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
            $<AnimatedMetric value={wassersteinValue} format={(v) => v.toFixed(2)} />
          </div>
          <p className="text-[11px] text-slate-400">
            Physical divergence of monetary amount distributions between folds
          </p>
        </div>

        {/* Health Status Indicator */}
        <div className="ultra-card ultra-crown p-5 space-y-2">
          <div className="text-xs font-semibold text-slate-500">System Robustness State</div>
          <div className="text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2 pt-1">
            {driftReport.alert_level === "GREEN" ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span className="text-emerald-500">STATIONARY NORMAL</span>
              </>
            ) : driftReport.alert_level === "AMBER" ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-amber-500">MODERATE SHIFT</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <span className="text-rose-500">CRITICAL SHIFT DETECTED</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {driftReport.action_required ? "Automated threshold adaptation active." : "Policy operates at standard calibrated operating point."}
          </p>
        </div>
      </div>

      {/* Stress Testing Controller */}
      <div className="ultra-card ultra-crown p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Adversarial Stress Lab Injection</span>
            </h2>
            <p className="text-xs text-slate-400">
              Apply realistic financial fraud attacks to test the resilience of AEGIS-Fraud X drift detectors.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Backend Endpoint: /api/drift/simulate-stress</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ultra-stagger">
          {/* Card 1: Smurfing */}
          <div className={`p-4 rounded-xl border transition-all ${activeScenario === "smurfing" ? "border-rose-500 bg-rose-500/5 shadow-md" : "border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40"}`}>
            <div className="flex items-center justify-between text-xs font-bold text-rose-500 mb-1">
              <span>Attack Scenario 1</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10">STRUCTURING</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Adversarial Smurfing Burst
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Injects coordinated transactions sized $4,500 - $4,890 designed to evade $5,000 regulatory reporting thresholds.
            </p>
            <button
              onClick={() => handleTriggerStress("smurfing")}
              disabled={loading}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-sm"
            >
              {loading && activeScenario === "smurfing" ? "Simulating in Backend..." : "Inject Smurfing Attack"}
            </button>
          </div>

          {/* Card 2: Device Spoofing */}
          <div className={`p-4 rounded-xl border transition-all ${activeScenario === "spoofing" ? "border-amber-500 bg-amber-500/5 shadow-md" : "border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40"}`}>
            <div className="flex items-center justify-between text-xs font-bold text-amber-500 mb-1">
              <span>Attack Scenario 2</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10">PROXY NET</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Device Spoofing &amp; Proxy Surge
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Simulates a sudden influx of randomized browser fingerprints and rotating Tor/VPN IP subnets.
            </p>
            <button
              onClick={() => handleTriggerStress("spoofing")}
              disabled={loading}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-500 text-navy-950 hover:bg-amber-600 transition-all shadow-sm"
            >
              {loading && activeScenario === "spoofing" ? "Simulating in Backend..." : "Inject Device Spoofing"}
            </button>
          </div>

          {/* Card 3: Restore Clean Stationary Stream */}
          <div className={`p-4 rounded-xl border transition-all ${activeScenario === "none" ? "border-emerald-500 bg-emerald-500/5 shadow-md" : "border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40"}`}>
            <div className="flex items-center justify-between text-xs font-bold text-emerald-500 mb-1">
              <span>Baseline State</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10">NORMAL</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Clean Stationary Flow
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Restores standard consumer transaction stream with historical circadian rhythm and low baseline fraud (2%).
            </p>
            <button
              onClick={() => handleTriggerStress("none")}
              disabled={loading}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-emerald-500 text-navy-950 hover:bg-emerald-600 transition-all shadow-sm"
            >
              {loading && activeScenario === "none" ? "Restoring..." : "Restore Stationary Stream"}
            </button>
          </div>
        </div>

        {/* Dynamic Scenario Result Summary */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-100 dark:border-navy-700 space-y-2 text-xs">
          <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
              <span>Active Scenario: {driftReport.scenario_description || "Stationary Stream"}</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">PSI: {driftReport.amount_psi}</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
            {driftReport.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
};
