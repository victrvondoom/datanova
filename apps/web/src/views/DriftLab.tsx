import React, { useState, useEffect } from "react";
import { Activity, AlertTriangle, ShieldCheck, Zap, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { evaluateDrift, simulateStress } from "../api";

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
    runDriftCheck();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Concept Shift &amp; Adversarial Robustness
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Fraud Drift &amp; Stress Testing Laboratory
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PSI Metric */}
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Population Stability Index (PSI)</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                driftReport.alert_level === "GREEN"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : driftReport.alert_level === "AMBER"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {driftReport.alert_level}
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
            {driftReport.amount_psi !== undefined ? driftReport.amount_psi.toFixed(4) : "0.0342"}
          </div>
          <p className="text-[11px] text-slate-400">
            Threshold: PSI &lt; 0.10 Stable | 0.10 - 0.25 Moderate | &ge; 0.25 Significant
          </p>
        </div>

        {/* Wasserstein Distance */}
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Wasserstein Distance ($W_1$)</span>
            <span className="text-accent-teal text-xs font-mono font-bold">Earth Mover</span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
            ${driftReport.amount_wasserstein_distance !== undefined ? driftReport.amount_wasserstein_distance.toFixed(2) : "14.82"}
          </div>
          <p className="text-[11px] text-slate-400">
            Physical divergence of monetary amount distributions between folds
          </p>
        </div>

        {/* Health Status Indicator */}
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
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
      <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
