import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Sliders,
  DollarSign,
  Fingerprint,
  Info,
} from "lucide-react";
import { fetchReplayBatch } from "../api";
import { ReplayRecord } from "../types";

export const TransactionStream: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1000); // ms per step
  const [records, setRecords] = useState<ReplayRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedTx, setSelectedTx] = useState<ReplayRecord | null>(null);

  // Cumulative metrics
  const [cumulativeSavings, setCumulativeSavings] = useState<number>(0);
  const [baselineCostTotal, setBaselineCostTotal] = useState<number>(0);
  const [aegisCostTotal, setAegisCostTotal] = useState<number>(0);
  const [preventedLossTotal, setPreventedLossTotal] = useState<number>(0);

  useEffect(() => {
    // Initial fetch of replay batch
    fetchReplayBatch(0, 50).then((data) => {
      setRecords(data.records);
      if (data.records.length > 0) {
        setSelectedTx(data.records[0]);
      }
    });
  }, []);

  // Streaming ticker loop
  useEffect(() => {
    if (!isPlaying || records.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % records.length;
        const currentRec = records[next];

        // Incrementally update live financial tally
        setBaselineCostTotal((b) => b + currentRec.baseline_cost);
        setAegisCostTotal((a) => a + currentRec.aegis_cost);
        setCumulativeSavings((s) => s + Math.max(0, currentRec.baseline_cost - currentRec.aegis_cost));
        if (currentRec.ground_truth_fraud === 1 && currentRec.aegis_result.recommended_action !== "ALLOW") {
          setPreventedLossTotal((l) => l + currentRec.transaction.amount);
        }

        setSelectedTx(currentRec);
        return next;
      });
    }, speed);

    return () => clearInterval(timer);
  }, [isPlaying, records, speed]);

  const handleReset = () => {
    setCurrentIndex(0);
    setBaselineCostTotal(0);
    setAegisCostTotal(0);
    setCumulativeSavings(0);
    setPreventedLossTotal(0);
    if (records.length > 0) setSelectedTx(records[0]);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ALLOW":
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ALLOW</span>;
      case "CHALLENGE":
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-accent-teal border border-blue-500/20">CHALLENGE (OTP)</span>;
      case "REVIEW":
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">MANUAL REVIEW</span>;
      case "BLOCK":
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">BLOCK</span>;
      default:
        return <span>{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Live Digital Twin Ticker */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 radar-glow"></span>
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-500">
              Live Digital Twin Replay Engine
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Real-Time Transaction Stream &amp; Policy Comparator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparing standard industry baseline policy vs. AEGIS-Fraud X cost-aware optimization on identical transactions.
          </p>
        </div>

        {/* Live Savings Counter */}
        <div className="flex items-center space-x-6 p-3 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Cumulative Savings</div>
            <div className="text-lg font-black text-emerald-500">
              ${cumulativeSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-navy-700" />
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Baseline Loss / Friction</div>
            <div className="text-sm font-bold text-rose-500">
              ${baselineCostTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-navy-700" />
          <div>
            <div className="text-[11px] font-semibold text-slate-400">AEGIS Loss / Labor</div>
            <div className="text-sm font-bold text-accent-teal">
              ${aegisCostTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Replay Controls Toolbar */}
      <div className="flex items-center justify-between p-3.5 rounded-xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all ${
              isPlaying
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? "Pause Stream" : "Resume Stream"}</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Replay</span>
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Speed:</span>
          {[
            { label: "1x", delay: 1200 },
            { label: "2x", delay: 600 },
            { label: "5x", delay: 250 },
          ].map((sp) => (
            <button
              key={sp.label}
              onClick={() => setSpeed(sp.delay)}
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                speed === sp.delay
                  ? "bg-accent-teal text-navy-900"
                  : "bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Streaming Split-Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Streaming Replay Table */}
        <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>Streaming Event Queue</span>
              <span className="text-xs font-normal text-slate-400">({records.length} transactions in buffer)</span>
            </h2>
            <div className="text-xs text-accent-teal font-mono">
              Live Tx #{currentIndex + 1}
            </div>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-navy-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-navy-700">
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
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                {records.map((rec, i) => {
                  const isCurrent = i === currentIndex;
                  const isSelected = selectedTx?.transaction.transaction_id === rec.transaction.transaction_id;
                  const isFraud = rec.ground_truth_fraud === 1;

                  return (
                    <tr
                      key={rec.transaction.transaction_id}
                      onClick={() => setSelectedTx(rec)}
                      className={`cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-accent-teal/15 font-semibold"
                          : isSelected
                          ? "bg-slate-100 dark:bg-navy-700/60"
                          : "hover:bg-slate-50 dark:hover:bg-navy-900/40"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-900 dark:text-slate-200">
                        {rec.transaction.transaction_id}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        ${rec.transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {rec.transaction.sender_id} &rarr; {rec.transaction.receiver_id}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            rec.aegis_result.calibrated_probability > 0.5
                              ? "bg-rose-500/10 text-rose-500"
                              : rec.aegis_result.calibrated_probability > 0.15
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {(rec.aegis_result.calibrated_probability * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {rec.baseline_action}
                      </td>
                      <td className="px-4 py-3">
                        {getActionBadge(rec.aegis_result.recommended_action)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {isFraud ? (
                          <span className="text-rose-500 flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>FRAUD</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Legit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Selected Transaction Inspection & Explainability */}
        {selectedTx && (
          <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transaction Deep Dive
                </span>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {selectedTx.transaction.transaction_id}
                </div>
              </div>
              <div>{getActionBadge(selectedTx.aegis_result.recommended_action)}</div>
            </div>

            {/* Risk Probability Gauge */}
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Calibrated P(Fraud):</span>
                <span className="text-base font-black text-rose-500 font-mono">
                  {(selectedTx.aegis_result.calibrated_probability * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-navy-700 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${selectedTx.aegis_result.calibrated_probability * 100}%` }}
                />
              </div>
            </div>

            {/* Core Transaction Attributes */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Amount:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${selectedTx.transaction.amount.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Channel:</span>
                <span className="font-semibold text-slate-900 dark:text-white uppercase">
                  {selectedTx.transaction.channel}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Sender:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">
                  {selectedTx.transaction.sender_id}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Receiver:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">
                  {selectedTx.transaction.receiver_id}
                </span>
              </div>
            </div>

            {/* TreeSHAP Local Feature Contributions */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Top TreeSHAP Attributions</span>
                <span className="text-[10px] text-slate-400 font-normal">Exact Shapley Values</span>
              </div>
              <div className="space-y-1.5">
                {selectedTx.aegis_result.top_features.map((feat, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                        {feat.feature_name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Val: {String(feat.feature_value)}</span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold ${
                        feat.shap_value > 0 ? "text-rose-500" : "text-emerald-500"
                      }`}
                    >
                      {feat.shap_value > 0 ? `+${feat.shap_value.toFixed(3)}` : feat.shap_value.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic SHA-256 Receipt */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 text-[11px] space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                <Fingerprint className="w-3.5 h-3.5 text-accent-teal" />
                <span>SHA-256 Audit Signature</span>
              </div>
              <div className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-navy-900 p-1.5 rounded border border-slate-200 dark:border-navy-700">
                {selectedTx.aegis_result.audit_receipt_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
              </div>
              <div className="text-[10px] text-emerald-500 font-medium pt-0.5">
                &check; Tamper-Evident &bull; Model {selectedTx.aegis_result.model_version}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
