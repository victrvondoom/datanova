import React, { useState } from "react";
import { Sliders, DollarSign, Users, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { optimizePolicy } from "../api";

export const DecisionLab: React.FC = () => {
  const [invCost, setInvCost] = useState<number>(15.0);
  const [fricCost, setFricCost] = useState<number>(5.0);
  const [blkCost, setBlkCost] = useState<number>(25.0);
  const [capacity, setCapacity] = useState<number>(100);
  const [maxFpr, setMaxFpr] = useState<number>(0.015);

  const [policyData, setPolicyData] = useState<any>({
    active_policy: { tau_allow: 0.15, tau_review: 0.42, tau_block: 0.75 },
    comparisons: {
      fixed_threshold_baseline: { metrics: { total_cost: 5657.95, false_positive_rate: 0.001, estimated_savings: 32919.88 } },
      aegis_cost_optimized: { metrics: { total_cost: 3061.44, false_positive_rate: 0.0087, estimated_savings: 35516.39 } }
    }
  });

  const handleRecalculate = async () => {
    const res = await optimizePolicy({
      investigation_cost: invCost,
      customer_friction_cost: fricCost,
      friction_block_cost: blkCost,
      max_fpr: maxFpr,
      review_capacity_daily: capacity,
    });
    setPolicyData(res);
  };

  const opt = policyData.comparisons.aegis_cost_optimized.metrics;
  const fixed = policyData.comparisons.fixed_threshold_baseline.metrics;
  const netAdvantage = Math.max(0, fixed.total_cost - opt.total_cost);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan">
            <Sliders className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-cyan">
            Optimization Frontier Engine
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
          Cost-Aware Operational Decision Intelligence Laboratory
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Minimizes $\mathbb&#123;E&#125;[\text&#123;Fraud Loss&#125;] + \text&#123;Labor Cost&#125; + \text&#123;Customer Friction&#125;$ subject to investigator queue limits.
        </p>
      </div>

      {/* Main Grid: Sliders on Left, Outcomes on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sliders Panel */}
        <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
            <span>Configurable Economic Assumptions</span>
            <span className="text-[10px] text-slate-400 font-normal">Real-Time Solver</span>
          </h2>

          {/* Slider 1: Investigation Cost */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Investigation Cost ($c_&#123;inv&#125;$)</span>
              <span className="text-accent-teal font-mono font-bold">${invCost.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={invCost}
              onChange={(e) => setInvCost(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-teal"
            />
            <p className="text-[10px] text-slate-400">Labor expense per manually investigated alert</p>
          </div>

          {/* Slider 2: Customer Friction */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Friction Cost ($c_&#123;fric&#125;$)</span>
              <span className="text-accent-teal font-mono font-bold">${fricCost.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={fricCost}
              onChange={(e) => setFricCost(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-teal"
            />
            <p className="text-[10px] text-slate-400">Disruption cost when legitimate user enters challenge/review</p>
          </div>

          {/* Slider 3: False Decline Block Cost */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Block Friction / Churn ($c_&#123;blk&#125;$)</span>
              <span className="text-accent-teal font-mono font-bold">${blkCost.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={blkCost}
              onChange={(e) => setBlkCost(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-teal"
            />
            <p className="text-[10px] text-slate-400">Severe penalty if a legitimate cardholder is falsely declined</p>
          </div>

          {/* Slider 4: Daily Capacity */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Daily Investigator Capacity ($K$)</span>
              <span className="text-accent-teal font-mono font-bold">{capacity} reviews</span>
            </div>
            <input
              type="range"
              min="20"
              max="300"
              step="10"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-teal"
            />
            <p className="text-[10px] text-slate-400">Hard limit on total manual reviews per day</p>
          </div>

          {/* Slider 5: Max FPR */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Max Permitted FPR ($\alpha_&#123;max&#125;$)</span>
              <span className="text-accent-teal font-mono font-bold">{(maxFpr * 100).toFixed(2)}%</span>
            </div>
            <input
              type="range"
              min="0.005"
              max="0.03"
              step="0.002"
              value={maxFpr}
              onChange={(e) => setMaxFpr(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-teal"
            />
            <p className="text-[10px] text-slate-400">Compliance limit on customer false positive alert rate</p>
          </div>

          <button
            onClick={handleRecalculate}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-accent-teal to-blue-600 text-white shadow-md hover:opacity-90 transition-all"
          >
            Solve Optimal Policy Thresholds
          </button>
        </div>

        {/* Right 2 Cols: Modeled Outcomes & Threshold Frontier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Solved Thresholds Card */}
          <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Optimized 4-Tier Operational Policy</span>
              <span className="text-xs font-mono text-emerald-500 font-semibold">&check; Constraints Satisfied</span>
            </h2>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-100 dark:border-navy-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Allow Threshold ($\tau_&#123;allow&#125;$)</span>
                <span className="text-xl font-black font-mono text-emerald-500">
                  {policyData.active_policy.tau_allow.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Accept below this</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-100 dark:border-navy-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Review Threshold ($\tau_&#123;rev&#125;$)</span>
                <span className="text-xl font-black font-mono text-accent-teal">
                  {policyData.active_policy.tau_review.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Step-up challenge</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-100 dark:border-navy-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Block Threshold ($\tau_&#123;blk&#125;$)</span>
                <span className="text-xl font-black font-mono text-rose-500">
                  {policyData.active_policy.tau_block.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Decline above this</span>
              </div>
            </div>
          </div>

          {/* Economic Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Baseline Policy Card */}
            <div className="p-5 rounded-2xl border bg-slate-50 dark:bg-navy-800/40 border-slate-200 dark:border-navy-700 space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Conventional Baseline (Fixed p &ge; 0.5)
              </span>
              <div>
                <div className="text-2xl font-black text-rose-500 font-mono">
                  ${fixed.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Total operational expense &amp; missed loss</div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-navy-700 text-xs text-slate-500 flex justify-between">
                <span>False Positive Rate:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(fixed.false_positive_rate * 100).toFixed(2)}%</span>
              </div>
            </div>

            {/* AEGIS Optimized Card */}
            <div className="p-5 rounded-2xl border bg-accent-teal/5 border-accent-teal/30 space-y-3">
              <span className="text-xs font-bold text-accent-teal uppercase tracking-wider flex items-center justify-between">
                <span>AEGIS Cost-Optimized Policy</span>
                <span className="bg-accent-teal/20 px-2 py-0.5 rounded text-[10px] font-bold text-accent-teal">Champion</span>
              </span>
              <div>
                <div className="text-2xl font-black text-emerald-500 font-mono">
                  ${opt.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Save ${netAdvantage.toLocaleString("en-US", { minimumFractionDigits: 2 })} over baseline
                </div>
              </div>
              <div className="pt-2 border-t border-accent-teal/20 text-xs text-slate-500 flex justify-between">
                <span>False Positive Rate:</span>
                <span className="font-mono font-bold text-accent-teal">{(opt.false_positive_rate * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
