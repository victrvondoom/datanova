import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Fingerprint,
  PlusCircle,
  X,
  Send,
  Zap,
  Filter,
  KeyRound,
  SearchCheck,
} from "lucide-react";
import { fetchReplayBatch, injectTransaction } from "../api";
import { ReplayRecord } from "../types";
import { useCountUp } from "../lib/useCountUp";
import { formatKpiValue, staggerDelayMs } from "../lib/ultra";

/** Animated cumulative metric readout (hook-per-metric, presentation only). */
const LiveMetric: React.FC<{
  label: string;
  target: number;
  tone: string;
  size?: string;
}> = ({ label, target, tone, size = "text-sm" }) => {
  const animated = useCountUp(target, { durationMs: 700 });
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{label}</div>
      <div className={`ultra-metric ultra-metric-drawn font-black ${tone} ${size}`}>
        {formatKpiValue(animated, { decimals: 2, prefix: "$" })}
      </div>
    </div>
  );
};

export const TransactionStream: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1000); // ms per step
  const [records, setRecords] = useState<ReplayRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedTx, setSelectedTx] = useState<ReplayRecord | null>(null);
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [streamFilter, setStreamFilter] = useState<string>("all");

  // Cumulative metrics
  const [cumulativeSavings, setCumulativeSavings] = useState<number>(0);
  const [baselineCostTotal, setBaselineCostTotal] = useState<number>(0);
  const [aegisCostTotal, setAegisCostTotal] = useState<number>(0);
  const [preventedLossTotal, setPreventedLossTotal] = useState<number>(0);

  // Injection Modal State
  const [isInjectOpen, setIsInjectOpen] = useState<boolean>(false);
  const [injectSender, setInjectSender] = useState<string>("usr_mule_88");
  const [injectReceiver, setInjectReceiver] = useState<string>("mule_001");
  const [injectAmount, setInjectAmount] = useState<number>(4850.0);
  const [injectChannel, setInjectChannel] = useState<string>("p2p");
  const [injectCategory, setInjectCategory] = useState<string>("money_transfer");
  const [injectDevice, setInjectDevice] = useState<string>("dev_tor_exit_99");
  const [injectIsFraud, setInjectIsFraud] = useState<number>(1);
  const [injecting, setInjecting] = useState<boolean>(false);
  const [injectSuccessMsg, setInjectSuccessMsg] = useState<string | null>(null);

  // Animated readouts for the deep-dive panel (targets come from live data only)
  const animatedProbability = useCountUp(
    selectedTx?.aegis_result.calibrated_probability ?? 0,
    { durationMs: 500 },
  );
  const animatedAmount = useCountUp(selectedTx?.transaction.amount ?? 0, {
    durationMs: 500,
  });

  // Load next batch
  const loadBatch = useCallback(async (offset: number) => {
    const data = await fetchReplayBatch(offset, 50);
    if (data.records && data.records.length > 0) {
      setRecords((prev) => (offset === 0 ? data.records : [...prev, ...data.records]));
      if (offset === 0 && data.records.length > 0) {
        setSelectedTx(data.records[0]);
      }
    }
  }, []);

  useEffect(() => {
    // deferred off the render commit (avoids cascading setState in the
    // effect body); the cleanup cancels the load if the view unmounts first
    const t = window.setTimeout(() => loadBatch(0), 0);
    return () => window.clearTimeout(t);
  }, [loadBatch]);

  // Streaming ticker loop
  useEffect(() => {
    if (!isPlaying || records.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        // Dynamically fetch next batch when 10 transactions from end
        if (next >= records.length - 10) {
          const newOffset = currentOffset + 50;
          setCurrentOffset(newOffset);
          loadBatch(newOffset);
        }

        const safeIdx = next % records.length;
        const currentRec = records[safeIdx];
        if (currentRec) {
          setBaselineCostTotal((b) => b + currentRec.baseline_cost);
          setAegisCostTotal((a) => a + currentRec.aegis_cost);
          setCumulativeSavings((s) => s + Math.max(0, currentRec.baseline_cost - currentRec.aegis_cost));
          if (currentRec.ground_truth_fraud === 1 && currentRec.aegis_result.recommended_action !== "ALLOW") {
            setPreventedLossTotal((l) => l + currentRec.transaction.amount);
          }
          setSelectedTx(currentRec);
        }
        return safeIdx;
      });
    }, speed);

    return () => clearInterval(timer);
  }, [isPlaying, records, speed, currentOffset, loadBatch]);

  const handleReset = () => {
    setCurrentIndex(0);
    setBaselineCostTotal(0);
    setAegisCostTotal(0);
    setCumulativeSavings(0);
    setPreventedLossTotal(0);
    if (records.length > 0) setSelectedTx(records[0]);
  };

  const handleApplyPreset = (type: "smurfing" | "mule_chain" | "legit" | "high_risk_cnp") => {
    if (type === "smurfing") {
      setInjectSender("usr_struct_01");
      setInjectReceiver("merch_crypto_desk");
      setInjectAmount(4890.0);
      setInjectChannel("p2p");
      setInjectCategory("money_transfer");
      setInjectDevice("dev_proxy_01");
      setInjectIsFraud(1);
    } else if (type === "mule_chain") {
      setInjectSender("mule_004");
      setInjectReceiver("mule_001");
      setInjectAmount(2400.0);
      setInjectChannel("p2p");
      setInjectCategory("money_transfer");
      setInjectDevice("dev_shared_ring");
      setInjectIsFraud(1);
    } else if (type === "legit") {
      setInjectSender("usr_alice_regular");
      setInjectReceiver("merch_starbucks");
      setInjectAmount(14.75);
      setInjectChannel("mobile");
      setInjectCategory("food_dining");
      setInjectDevice("dev_iphone_15_trusted");
      setInjectIsFraud(0);
    } else {
      setInjectSender("usr_compromised_acct");
      setInjectReceiver("merch_luxury_electronics");
      setInjectAmount(1850.0);
      setInjectChannel("web");
      setInjectCategory("retail");
      setInjectDevice("dev_unknown_browser");
      setInjectIsFraud(1);
    }
  };

  const handleInjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInjecting(true);
    setInjectSuccessMsg(null);
    try {
      const res = await injectTransaction({
        sender_id: injectSender,
        receiver_id: injectReceiver,
        amount: injectAmount,
        channel: injectChannel,
        device_id: injectDevice,
        category: injectCategory,
        is_fraud_simulated: injectIsFraud,
      });

      const scoreRes = res.score_result;
      const tx = res.transaction;

      const baselineAct = scoreRes.calibrated_probability >= 0.5 ? "BLOCK" : "ALLOW";
      const baseCost = baselineAct === "BLOCK" && injectIsFraud === 0 ? 25.0 : (baselineAct === "ALLOW" && injectIsFraud === 1 ? injectAmount : 0);
      const aegisCost = scoreRes.expected_cost;

      const newRecord: ReplayRecord = {
        transaction: tx,
        aegis_result: scoreRes,
        baseline_action: baselineAct,
        baseline_cost: baseCost,
        aegis_cost: aegisCost,
        ground_truth_fraud: injectIsFraud,
      };

      // Prepend to live stream and select immediately
      setRecords((prev) => [newRecord, ...prev]);
      setSelectedTx(newRecord);
      setCurrentIndex(0);
      setInjectSuccessMsg(`Transaction ${tx.transaction_id} scored live (${scoreRes.recommended_action}, P=${scoreRes.calibrated_probability}) and committed to temporal graph!`);

      setTimeout(() => {
        setIsInjectOpen(false);
        setInjectSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert("Failed to inject transaction: " + err.message);
    } finally {
      setInjecting(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ALLOW":
        return (
          <span className="ultra-chip bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span className="font-mono font-bold tracking-wide">ALLOW</span>
          </span>
        );
      case "CHALLENGE":
        return (
          <span className="ultra-chip bg-blue-500/10 border-blue-500/30 text-cyan-700 dark:text-accent-teal">
            <KeyRound className="w-3 h-3 shrink-0" />
            <span className="font-mono font-bold tracking-wide">CHALLENGE (OTP)</span>
          </span>
        );
      case "REVIEW":
        return (
          <span className="ultra-chip bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
            <SearchCheck className="w-3 h-3 shrink-0" />
            <span className="font-mono font-bold tracking-wide">MANUAL REVIEW</span>
          </span>
        );
      case "BLOCK":
        return (
          <span className="ultra-chip bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span className="font-mono font-bold tracking-wide">BLOCK</span>
          </span>
        );
      default:
        return <span>{action}</span>;
    }
  };

  const filteredRecords = records.filter((r) => {
    if (streamFilter === "fraud") return r.ground_truth_fraud === 1;
    if (streamFilter === "block") return r.aegis_result.recommended_action === "BLOCK";
    if (streamFilter === "review") return r.aegis_result.recommended_action === "REVIEW";
    if (streamFilter === "challenge") return r.aegis_result.recommended_action === "CHALLENGE";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Live Digital Twin Metric Ticker */}
      <div className="relative overflow-hidden rounded-2xl border p-5 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 border-navy-700 text-white shadow-card-ultra">
        <div className="ultra-grid-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Zap className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Live Digital Twin Replay Engine
              </span>
            </div>
            <h1 className="text-xl font-bold mt-1">
              <span className="ultra-shimmer-text font-display">Real-Time Transaction Stream &amp; Policy Comparator</span>
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Comparing standard industry baseline policy vs. AEGIS-Fraud X cost-aware optimization on live streaming transactions.
            </p>
          </div>

          {/* Live Savings Counter */}
          <div className="ultra-stagger flex flex-wrap items-center gap-x-6 gap-y-3 p-3 rounded-xl bg-navy-950/40 border border-navy-700/70 backdrop-blur-md">
            <LiveMetric
              label="Cumulative Savings"
              target={cumulativeSavings}
              tone="text-emerald-700 dark:text-emerald-400"
              size="text-lg"
            />
            <div className="h-8 w-px bg-navy-700" />
            <LiveMetric
              label="Baseline Loss / Friction"
              target={baselineCostTotal}
              tone="text-rose-700 dark:text-rose-400"
            />
            <div className="h-8 w-px bg-navy-700" />
            <LiveMetric
              label="AEGIS Loss / Labor"
              target={aegisCostTotal}
              tone="text-cyan-700 dark:text-accent-teal"
            />
            <div className="h-8 w-px bg-navy-700" />
            <LiveMetric
              label="Fraud Value Intercepted"
              target={preventedLossTotal}
              tone="text-amber-700 dark:text-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Replay Controls & Injection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-white/80 dark:bg-navy-800/80 border-zinc-200 dark:border-navy-700 backdrop-blur-md shadow-sm text-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all ${
              isPlaying
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? "Pause Stream" : "Resume Stream"}</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-navy-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-navy-700 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Inject Transaction Modal Trigger */}
          <button
            onClick={() => setIsInjectOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent-teal text-navy-950 hover:bg-accent-cyan shadow-sm hover:shadow-glow-teal transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Inject Live Transaction</span>
          </button>
        </div>

        {/* Filter Controls & Speed Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-navy-900 p-1 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 ml-1.5 mr-1" />
            {[
              { id: "all", label: "All" },
              { id: "fraud", label: "Fraud (Ground Truth)" },
              { id: "block", label: "Blocks" },
              { id: "review", label: "Reviews" },
              { id: "challenge", label: "OTP Challenges" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStreamFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  streamFilter === f.id
                    ? "bg-white dark:bg-navy-800 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-zinc-600 dark:text-zinc-300">Speed:</span>
            {[
              { label: "1x", delay: 1200 },
              { label: "2x", delay: 600 },
              { label: "5x", delay: 250 },
            ].map((sp) => (
              <button
                key={sp.label}
                onClick={() => setSpeed(sp.delay)}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  speed === sp.delay
                    ? "bg-accent-teal text-navy-900 shadow-glow-teal"
                    : "bg-zinc-100 dark:bg-navy-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Streaming Split-Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Streaming Replay Table */}
        <div className="lg:col-span-2 ultra-card ultra-crown overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-navy-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
              <span>Streaming Event Queue</span>
              <span className="text-xs font-normal text-zinc-600 dark:text-zinc-300">({filteredRecords.length} visible in memory)</span>
            </h2>
            <div className="ultra-metric ultra-metric-drawn text-xs text-cyan-700 dark:text-accent-teal font-mono">
              Live Tx #{currentIndex + 1}
            </div>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-navy-900/90 backdrop-blur-sm text-zinc-600 dark:text-zinc-300 uppercase text-[10px] tracking-wider border-b border-zinc-200 dark:border-navy-700">
                <tr>
                  <th className="px-4 py-2.5">Tx ID</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Sender / Recv</th>
                  <th className="px-4 py-2.5">Calibrated P(Fraud)</th>
                  <th className="px-4 py-2.5">Baseline Action</th>
                  <th className="px-4 py-2.5">AEGIS Action</th>
                  <th className="px-4 py-2.5">Ground Truth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-navy-700/50">
                {filteredRecords.map((rec, i) => {
                  const isCurrent = i === currentIndex;
                  const isSelected = selectedTx?.transaction.transaction_id === rec.transaction.transaction_id;
                  const isFraud = rec.ground_truth_fraud === 1;

                  return (
                    <tr
                      key={rec.transaction.transaction_id}
                      onClick={() => setSelectedTx(rec)}
                      style={{ animationDelay: `${staggerDelayMs(Math.min(i, 10))}ms` }}
                      className={`ultra-row animate-fade-up cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-accent-teal/10 dark:bg-accent-teal/15 border-l-4 border-accent-teal"
                          : isSelected
                          ? "bg-zinc-100 dark:bg-navy-700/60"
                          : "hover:bg-zinc-50 dark:hover:bg-navy-900/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-zinc-900 dark:text-white">
                        {rec.transaction.transaction_id}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">
                        ${rec.transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">
                        {rec.transaction.sender_id} &rarr; {rec.transaction.receiver_id}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <div className="ultra-progress-track w-10 h-1.5 shrink-0">
                            <div
                              className="ultra-progress-fill"
                              style={{ width: `${rec.aegis_result.calibrated_probability * 100}%` }}
                            />
                          </div>
                          <span
                            className={`font-bold ${
                              rec.aegis_result.calibrated_probability >= 0.5
                                ? "text-rose-700 dark:text-rose-400"
                                : rec.aegis_result.calibrated_probability >= 0.15
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {(rec.aegis_result.calibrated_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {getActionBadge(rec.baseline_action)}
                      </td>
                      <td className="px-4 py-2.5">
                        {getActionBadge(rec.aegis_result.recommended_action)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isFraud ? (
                          <span className="flex items-center space-x-1 text-rose-700 dark:text-rose-400 font-semibold text-[11px]">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>FRAUD</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-zinc-600 dark:text-zinc-300 text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span>Legit</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Live Inspection Card */}
        {selectedTx && (
          <div className="ultra-card ultra-crown ultra-gradient-ring ultra-stagger p-5 space-y-4 overflow-hidden">
            <div className="pb-3 border-b border-zinc-100 dark:border-navy-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Transaction Deep-Dive
                </span>
                <div className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                  {selectedTx.transaction.transaction_id}
                </div>
              </div>
              <div>{getActionBadge(selectedTx.aegis_result.recommended_action)}</div>
            </div>

            {/* Probability Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-300 font-medium">Calibrated Fraud Likelihood:</span>
                <span
                  className={`ultra-metric font-bold ${
                    selectedTx.aegis_result.calibrated_probability >= 0.5
                      ? "text-rose-700 dark:text-rose-400"
                      : selectedTx.aegis_result.calibrated_probability >= 0.15
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                    }`}
                >
                  {(animatedProbability * 100).toFixed(2)}%
                </span>
              </div>
              <div className="ultra-progress-track w-full h-2.5">
                <div
                  className="ultra-progress-fill"
                  style={{ width: `${selectedTx.aegis_result.calibrated_probability * 100}%` }}
                />
              </div>
            </div>

            {/* Core Transaction Attributes */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-navy-900/40 border border-zinc-100 dark:border-navy-700">
                <span className="text-zinc-600 dark:text-zinc-300 block text-[10px]">Amount:</span>
                <span className="ultra-metric font-bold text-zinc-900 dark:text-white">
                  ${animatedAmount.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-navy-900/40 border border-zinc-100 dark:border-navy-700">
                <span className="text-zinc-600 dark:text-zinc-300 block text-[10px]">Channel:</span>
                <span className="font-semibold text-zinc-900 dark:text-white uppercase">
                  {selectedTx.transaction.channel}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-navy-900/40 border border-zinc-100 dark:border-navy-700">
                <span className="text-zinc-600 dark:text-zinc-300 block text-[10px]">Sender:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate block">
                  {selectedTx.transaction.sender_id}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-navy-900/40 border border-zinc-100 dark:border-navy-700">
                <span className="text-zinc-600 dark:text-zinc-300 block text-[10px]">Receiver:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate block">
                  {selectedTx.transaction.receiver_id}
                </span>
              </div>
            </div>

            {/* TreeSHAP Local Feature Contributions */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-between">
                <span>Top TreeSHAP Attributions</span>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-300 font-normal">Exact Shapley Values</span>
              </div>
              <div className="space-y-1.5">
                {selectedTx.aegis_result.top_features && selectedTx.aegis_result.top_features.length > 0 ? (
                  selectedTx.aegis_result.top_features.map((feat, i) => (
                    <div
                      key={i}
                      style={{ animationDelay: `${staggerDelayMs(Math.min(i, 8))}ms` }}
                      className="ultra-row animate-fade-up text-xs p-2 rounded-lg bg-zinc-50 dark:bg-navy-900/40 border border-zinc-100 dark:border-navy-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono text-[11px]">
                          {feat.feature_name}
                        </span>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-300 block">Val: {String(feat.feature_value)}</span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          feat.shap_value > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {feat.shap_value > 0 ? `+${feat.shap_value.toFixed(3)}` : feat.shap_value.toFixed(3)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 italic p-2">Zero anomalous feature deviations.</div>
                )}
              </div>
            </div>

            {/* Cryptographic SHA-256 Receipt */}
            <div className="p-3 rounded-xl border border-zinc-100 dark:border-navy-700 bg-zinc-50 dark:bg-navy-900/60 text-[11px] space-y-1">
              <div className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-300 font-semibold">
                <Fingerprint className="w-3.5 h-3.5 text-cyan-700 dark:text-accent-teal" />
                <span>SHA-256 Audit Signature</span>
              </div>
              <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300 break-all bg-white dark:bg-navy-900 p-1.5 rounded border border-zinc-200 dark:border-navy-700">
                {selectedTx.aegis_result.audit_receipt_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                &check; Tamper-Evident &bull; Model {selectedTx.aegis_result.model_version}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Inject Transaction Modal */}
      {isInjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="ultra-card w-full max-w-xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-navy-700">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-accent-teal/10 text-cyan-700 dark:text-accent-teal">
                  <PlusCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white font-display">
                    Inject Dynamic Test Transaction
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    Live inference via LightGBM + NetworkX Temporal Graph &amp; TreeSHAP.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInjectOpen(false)}
                className="p-1 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-600 dark:hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Row */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Fast Attack Presets:</span>
              <div className="ultra-stagger grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset("smurfing")}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 transition-all text-center"
                >
                  Smurfing $4,890
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("mule_chain")}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all text-center"
                >
                  Mule Ring Flow
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("high_risk_cnp")}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all text-center"
                >
                  Account Takeover
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("legit")}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 hover:shadow-glow-emerald transition-all text-center"
                >
                  Legitimate $14.75
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleInjectSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Sender Account ID
                  </label>
                  <input
                    type="text"
                    required
                    value={injectSender}
                    onChange={(e) => setInjectSender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Receiver Account ID
                  </label>
                  <input
                    type="text"
                    required
                    value={injectReceiver}
                    onChange={(e) => setInjectReceiver(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Transaction Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={injectAmount}
                    onChange={(e) => setInjectAmount(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white font-mono font-bold transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={injectChannel}
                    onChange={(e) => setInjectChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  >
                    <option value="mobile">Mobile App</option>
                    <option value="p2p">P2P Instant Transfer</option>
                    <option value="web">Web Browser</option>
                    <option value="pos">Point of Sale (POS)</option>
                    <option value="atm">ATM Withdrawal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Device Fingerprint
                  </label>
                  <input
                    type="text"
                    value={injectDevice}
                    onChange={(e) => setInjectDevice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-300 font-semibold mb-1">
                    Ground Truth (Simulation)
                  </label>
                  <select
                    value={injectIsFraud}
                    onChange={(e) => setInjectIsFraud(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-navy-900 border-zinc-200 dark:border-navy-700 text-zinc-900 dark:text-white transition-all focus:ring-2 focus:ring-accent-teal/40 focus:border-accent-teal/60 outline-none"
                  >
                    <option value={1}>1 - Actual Fraud</option>
                    <option value={0}>0 - Legitimate Transaction</option>
                  </select>
                </div>
              </div>

              {injectSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center space-x-2 animate-fade-up">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{injectSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setIsInjectOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-navy-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-navy-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={injecting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold bg-accent-teal text-navy-950 hover:bg-accent-cyan hover:shadow-glow-teal transition-all shadow-md disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{injecting ? "Scoring & Committing..." : "Score & Commit to Graph"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
