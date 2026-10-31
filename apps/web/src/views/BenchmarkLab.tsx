import React, { useState, useEffect } from "react";
import { BarChart3, Award } from "lucide-react";
import { fetchBenchmarks } from "../api";

export const BenchmarkLab: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchBenchmarks().then((d) => setData(d));
  }, []);

  if (!data) return <div className="p-8 text-center text-sm text-slate-400">Loading benchmark artifacts...</div>;

  const bench = data.benchmark_summary;
  const ci = data.champion_confidence_intervals_95;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <BarChart3 className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
            Empirical Evaluation Suite
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
          ML Benchmark Laboratory — 6 Model Comparison
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Strict chronological train (6,000 tx) &rarr; validation calibration (2,000 tx) &rarr; held-out test evaluation (2,000 tx).
        </p>
      </div>

      {/* Main Benchmark Comparison Table */}
      <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Candidate Model Performance Matrix</span>
            <span className="text-xs font-normal text-slate-400">(Held-Out Test Set)</span>
          </h2>
          <span className="text-xs font-mono text-emerald-500 font-semibold">&check; Evaluated on Common Test Split</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-navy-700">
              <tr>
                <th className="px-4 py-3">Architecture</th>
                <th className="px-4 py-3">PR-AUC</th>
                <th className="px-4 py-3">ROC-AUC</th>
                <th className="px-4 py-3">Recall @ 1% FPR</th>
                <th className="px-4 py-3">Brier Score</th>
                <th className="px-4 py-3">Latency (ms)</th>
                <th className="px-4 py-3">Operational Cost</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
              {Object.entries(bench).map(([name, m]: [string, any]) => {
                const isChampion = name === data.champion_model_name;
                return (
                  <tr
                    key={name}
                    className={`transition-colors ${
                      isChampion
                        ? "bg-accent-teal/10 font-semibold dark:bg-accent-teal/15"
                        : "hover:bg-slate-50 dark:hover:bg-navy-900/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      {isChampion && <Award className="w-4 h-4 text-accent-teal" />}
                      <span>{name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-slate-900 dark:text-white">
                      {m.pr_auc.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {m.roc_auc.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-500 font-bold">
                      {(m.recall_at_fpr_1pct * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {m.brier_score.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {m.inference_latency_ms_per_tx.toFixed(2)} ms
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-white font-bold">
                      ${m.financial_outcomes.total_operational_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      {isChampion ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal text-navy-900 shadow-sm">
                          CHAMPION
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Baseline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 95% Bootstrap Confidence Intervals Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Champion PR-AUC (95% Bootstrap CI)
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            [{ci.pr_auc.ci_lower.toFixed(4)}, {ci.pr_auc.ci_upper.toFixed(4)}]
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Empirical bootstrap mean: <strong className="text-accent-teal">{ci.pr_auc.mean.toFixed(4)}</strong> (200 resamples with replacement).
          </p>
        </div>

        <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Champion ROC-AUC (95% Bootstrap CI)
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            [{ci.roc_auc.ci_lower.toFixed(4)}, {ci.roc_auc.ci_upper.toFixed(4)}]
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Empirical bootstrap mean: <strong className="text-accent-teal">{ci.roc_auc.mean.toFixed(4)}</strong> (200 resamples with replacement).
          </p>
        </div>
      </div>
    </div>
  );
};
