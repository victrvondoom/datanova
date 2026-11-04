import React, { useState, useEffect } from "react";
import { BarChart3, Award } from "lucide-react";
import { fetchBenchmarks } from "../api";
import { useLive } from "../lib/useLive";
import { LiveStatusChip } from "../components/LiveStatusChip";
import { useCountUp } from "../lib/useCountUp";

/** Mono metric that counts up from 0 and draws its gradient underline once mounted. */
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

/** Comparative meter bar: mounts at 0% and transitions to the target width. */
const Meter: React.FC<{ pct: number; fillClassName?: string }> = ({ pct, fillClassName = "" }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setWidth(Math.max(0, Math.min(100, pct))), 140);
    return () => window.clearTimeout(t);
  }, [pct]);
  return (
    <div className="ultra-progress-track h-1.5 w-24 max-w-full">
      <div className={`ultra-progress-fill ${fillClassName}`.trim()} style={{ width: `${width}%` }} />
    </div>
  );
};

/** 95% CI band on the unit interval with a mean marker; animates in after mount. */
const CiBar: React.FC<{ lower: number; upper: number; mean: number }> = ({ lower, upper, mean }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), 180);
    return () => window.clearTimeout(t);
  }, []);
  const clamp = (v: number) => Math.max(0, Math.min(100, v * 100));
  const left = clamp(lower);
  const width = Math.max(0, clamp(upper) - left);
  return (
    <div className="relative h-1.5 ultra-progress-track">
      <div
        className="absolute top-0 h-full rounded-full bg-gradient-to-r from-accent-teal to-accent-violet transition-all duration-700 ease-out"
        style={{ left: `${on ? left : 50}%`, width: `${on ? width : 0}%` }}
      />
      <div
        className="absolute -top-0.5 w-1 h-2.5 rounded-sm bg-accent-teal dark:bg-accent-cyan transition-all duration-700 ease-out"
        style={{ left: `${on ? clamp(mean) : 50}%` }}
      />
    </div>
  );
};

export const BenchmarkLab: React.FC = () => {
  // Benchmark artifacts are live: polled every 60s and refetched on focus,
  // so a regeneration under the running API shows up without a reload.
  const live = useLive(fetchBenchmarks, 60_000);
  const data: any = live.data;

  if (!data) return <div className="p-8 text-center text-sm text-zinc-600 dark:text-zinc-300 animate-pulse">Loading benchmark artifacts...</div>;

  const bench = data.benchmark_summary;
  const modelCount = Object.keys(bench).length;
  const ci = data.champion_confidence_intervals_95;
  const maxPrAuc = Math.max(...Object.values(bench).map((m: any) => m.pr_auc as number));

  return (
    <div className="space-y-6 ultra-stagger">
      {/* Header */}
      <div className="ultra-card ultra-crown p-5 overflow-hidden">
        <div className="ultra-grid-overlay absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-glow-emerald">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Empirical Evaluation Suite
            </span>
          </div>
          <h1 className="text-xl font-bold font-display text-zinc-900 dark:text-white mt-1">
            ML Benchmark Laboratory — <span className="ultra-shimmer-text">{modelCount} Model Comparison</span>
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Strict chronological train &rarr; validation calibration &rarr; held-out test evaluation.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <LiveStatusChip
              lastUpdatedAt={live.lastUpdatedAt}
              refreshing={live.refreshing}
              degraded={data.degraded === true}
              onRefresh={() => void live.refresh()}
            />
            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
              artifacts: {data?.timestamp ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Benchmark Comparison Table */}
      <div className="ultra-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-navy-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
            <span>Candidate Model Performance Matrix</span>
            <span className="text-xs font-normal text-zinc-600 dark:text-zinc-300">(Held-Out Test Set)</span>
          </h2>
          <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">&check; Evaluated on Common Test Split</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-navy-900/90 text-zinc-600 dark:text-zinc-300 uppercase text-[10px] tracking-wider border-b border-zinc-200 dark:border-navy-700">
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
            <tbody className="divide-y divide-zinc-100 dark:divide-navy-700/50">
              {Object.entries(bench).map(([name, m]: [string, any]) => {
                const isChampion = name === data.champion_model_name;
                return (
                  <tr
                    key={name}
                    className={`ultra-row transition-colors ${
                      isChampion
                        ? "bg-accent-teal/10 font-semibold dark:bg-accent-teal/15"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {isChampion ? (
                        <span className="ultra-gradient-ring rounded-lg inline-flex items-center space-x-2 px-2.5 py-1">
                          <Award className="w-4 h-4 text-cyan-700 dark:text-accent-teal" />
                          <span>{name}</span>
                        </span>
                      ) : (
                        <span>{name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isChampion ? (
                        <AnimatedMetric
                          value={m.pr_auc}
                          format={(v) => v.toFixed(4)}
                          className="font-black text-zinc-900 dark:text-white"
                        />
                      ) : (
                        <span className="font-mono text-zinc-600 dark:text-zinc-300">{m.pr_auc.toFixed(4)}</span>
                      )}
                      <div className="mt-1.5">
                        <Meter
                          pct={(m.pr_auc / maxPrAuc) * 100}
                          fillClassName={isChampion ? "opacity-100" : "opacity-50"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                      {isChampion ? (
                        <AnimatedMetric value={m.roc_auc} format={(v) => v.toFixed(4)} />
                      ) : (
                        m.roc_auc.toFixed(4)
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {isChampion ? (
                        <AnimatedMetric
                          value={m.recall_at_fpr_1pct * 100}
                          format={(v) => `${v.toFixed(1)}%`}
                        />
                      ) : (
                        `${(m.recall_at_fpr_1pct * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                      {m.brier_score.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                      {m.inference_latency_ms_per_tx.toFixed(2)} ms
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-900 dark:text-white font-bold">
                      {isChampion ? (
                        <AnimatedMetric
                          value={m.financial_outcomes.total_operational_cost}
                          format={(v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                        />
                      ) : (
                        `$${m.financial_outcomes.total_operational_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isChampion ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal text-navy-900 shadow-glow-teal">
                          CHAMPION
                        </span>
                      ) : (
                        <span className="text-zinc-600 dark:text-zinc-300 text-[11px]">Baseline</span>
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
        <div className="ultra-card ultra-crown p-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            Champion PR-AUC (95% Bootstrap CI)
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
            [<AnimatedMetric value={ci.pr_auc.ci_lower} format={(v) => v.toFixed(4)} />,{" "}
            <AnimatedMetric value={ci.pr_auc.ci_upper} format={(v) => v.toFixed(4)} />]
          </div>
          <CiBar lower={ci.pr_auc.ci_lower} upper={ci.pr_auc.ci_upper} mean={ci.pr_auc.mean} />
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Empirical bootstrap mean: <strong className="text-cyan-700 dark:text-accent-teal">{ci.pr_auc.mean.toFixed(4)}</strong> (200 resamples with replacement).
          </p>
        </div>

        <div className="ultra-card ultra-crown p-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            Champion ROC-AUC (95% Bootstrap CI)
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
            [<AnimatedMetric value={ci.roc_auc.ci_lower} format={(v) => v.toFixed(4)} />,{" "}
            <AnimatedMetric value={ci.roc_auc.ci_upper} format={(v) => v.toFixed(4)} />]
          </div>
          <CiBar lower={ci.roc_auc.ci_lower} upper={ci.roc_auc.ci_upper} mean={ci.roc_auc.mean} />
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Empirical bootstrap mean: <strong className="text-cyan-700 dark:text-accent-teal">{ci.roc_auc.mean.toFixed(4)}</strong> (200 resamples with replacement).
          </p>
        </div>
      </div>
    </div>
  );
};
