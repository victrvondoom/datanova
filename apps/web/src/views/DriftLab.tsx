import React, { useState } from "react";
import { Activity, AlertTriangle, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { evaluateDrift } from "../api";

export const DriftLab: React.FC = () => {
  const [driftReport, setDriftReport] = useState<any>({
    status: "STABLE",
    amount_psi: 0.0342,
    amount_wasserstein_distance: 14.82,
    alert_level: "GREEN",
    reference_window: "Baseline Fold (First 1,000 tx)",
    monitoring_window: "Streaming Window (Next 1,000 tx)",
    action_required: false
  });
  const [runningStress, setRunningStress] = useState<boolean>(false);
  const [stressScenario, setStressScenario] = useState<string>("smurfing");

  const runDriftCheck = async () => {
    const res = await evaluateDrift();
    setDriftReport(res);
  };

  const handleTriggerStress = (scenario: string) => {
    setStressScenario(scenario);
    setRunningStress(true);
    setTimeout(() => {
      if (scenario === "smurfing") {
        setDriftReport({
          status: "WARNING",
          amount_psi: 0.1648,
          amount_wasserstein_distance: 42.15,
          alert_level: "AMBER",
          reference_window: "Baseline Historical Fold",
          monitoring_window: "Adversarial Smurfing Burst ($4,500 - $4,890)",
          action_required: true,
          details: "Amount distribution structured to evade $5,000 threshold. Graph cycle detectors engaged."
        });
      } else if (scenario === "spoofing") {
        setDriftReport({
          status: "CRITICAL_DRIFT",
          amount_psi: 0.2810,
          amount_wasserstein_distance: 68.30,
          alert_level: "RED",
          reference_window: "Baseline Historical Fold",
          monitoring_window: "Rapid Device / Tor Proxy Proliferation",
          action_required: true,
          details: "Sudden spike in high-entropy devices. Automatic policy adaptation triggered."
        });
      }
      setRunningStress(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
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
            {driftReport.amount_psi.toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-400">
            Threshold: PSI &lt; 0.10 Stable | 0.10 - 0.25 Moderate | &ge; 0.25 Significant
          </p>
        </div>

        {/* Wasserstein Distance */}
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Wasserstein Distance (EMD)</span>
            <span className="text-[10px] text-accent-teal font-mono">1D Metric</span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
            {driftReport.amount_wasserstein_distance.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            Earth Mover&apos;s Distance between baseline &amp; streaming distributions
          </p>
        </div>

        {/* Model State Action */}
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Monitoring Status</span>
            <button
              onClick={runDriftCheck}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500"
              title="Refresh Drift Check"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            {driftReport.status === "STABLE" ? (
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            )}
            <span>{driftReport.status}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {driftReport.action_required
              ? "Policy adaptation active: Elevated challenge and review thresholds."
              : "Operating within normal parameters. No concept shift detected."}
          </p>
        </div>
      </div>

      {/* Controlled Defensive Stress Injection Panel */}
      <div className="p-6 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Controlled Defensive Stress Injection
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluate system resilience under non-operational, synthetic stress scenarios.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300">
            Controlled Sandbox
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => handleTriggerStress("smurfing")}
            disabled={runningStress}
            className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 text-left hover:border-accent-teal hover:bg-accent-teal/5 transition-all space-y-1.5"
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">
              1. Smurfing / Structuring Attack
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Amounts structured to $4,500 - $4,890 to evade $5k threshold checks.
            </p>
          </button>

          <button
            onClick={() => handleTriggerStress("spoofing")}
            disabled={runningStress}
            className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 text-left hover:border-accent-teal hover:bg-accent-teal/5 transition-all space-y-1.5"
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">
              2. Device Fingerprint Spoofing
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rapid rotation of random high-entropy devices and proxy IP subnets.
            </p>
          </button>

          <button
            onClick={runDriftCheck}
            disabled={runningStress}
            className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 text-left hover:border-emerald-500 hover:bg-emerald-500/5 transition-all space-y-1.5"
          >
            <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
              3. Reset to Clean Stream
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Restore baseline stationary distribution.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
