import React, { useState, useEffect } from "react";
import { FileCheck2, Fingerprint, ShieldCheck, AlertCircle, Copy, Check, Send, Sparkles, ShieldAlert, ShieldQuestion, Search, Activity } from "lucide-react";
import { scoreTransaction, verifyReceipt } from "../api";
import { PredictionResult } from "../types";
import { useCountUp } from "../lib/useCountUp";
import { formatKpiValue, staggerDelayMs } from "../lib/ultra";

/** Animated SHAP attribution meter: draws its width on mount/re-score. */
const ShapBar: React.FC<{ shapValue: number; index: number }> = ({ shapValue, index }) => {
  const [drawn, setDrawn] = useState<boolean>(false);

  useEffect(() => {
    // Kick the width draw off one frame after mount so the transition runs.
    const raf = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const isPositive = shapValue > 0;
  const widthPct = Math.min(100, Math.max(8, Math.abs(shapValue) * 180));

  return (
    <div className="ultra-progress-track h-2">
      <div
        className="ultra-progress-fill"
        style={{
          width: `${drawn ? widthPct : 0}%`,
          transitionDelay: `${staggerDelayMs(index, 80)}ms`,
          background: isPositive
            ? "linear-gradient(90deg, #f43f5e, #fb7185, #f43f5e)"
            : "linear-gradient(90deg, #10b981, #34d399, #10b981)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
};

/** Headline risk readout: count-up number with animated underline draw. */
const ScoreMetric: React.FC<{ probability: number }> = ({ probability }) => {
  const [drawn, setDrawn] = useState<boolean>(false);
  const animated = useCountUp(probability * 100, { durationMs: 1400 });

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex items-end justify-between rounded-xl border border-slate-200/80 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/40 px-4 py-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Calibrated Fraud Probability
        </div>
        <span
          className={`ultra-metric text-2xl font-extrabold text-slate-900 dark:text-white ${
            drawn ? "ultra-metric-drawn" : ""
          }`}
        >
          {formatKpiValue(animated, { decimals: 1, suffix: "%" })}
        </span>
      </div>
      <Activity className="w-5 h-5 text-accent-teal dark:text-accent-cyan shrink-0" aria-hidden="true" />
    </div>
  );
};

/** Decision status chip: icon + mono label, count-up percentage. */
const ActionChip: React.FC<{ action: string; probability: number }> = ({ action, probability }) => {
  const animated = useCountUp(probability * 100, { durationMs: 1200 });

  const meta =
    action === "BLOCK"
      ? { icon: ShieldAlert, cls: "text-rose-500" }
      : action === "REVIEW"
      ? { icon: Search, cls: "text-amber-500" }
      : action === "CHALLENGE"
      ? { icon: ShieldQuestion, cls: "text-accent-teal" }
      : { icon: ShieldCheck, cls: "text-emerald-500" };
  const Icon = meta.icon;

  return (
    <span className={`ultra-chip ${meta.cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="font-mono font-bold">
        ACTION: {action} ({formatKpiValue(animated, { decimals: 1 })}%)
      </span>
    </span>
  );
};

export const ExplainabilityView: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [scoring, setScoring] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<{ is_valid: boolean; status: string } | null>(null);
  const [isTampered, setIsTampered] = useState<boolean>(false);

  // Form parameters
  const [senderId, setSenderId] = useState<string>("usr_mule_alpha");
  const [receiverId, setReceiverId] = useState<string>("mule_001");
  const [amount, setAmount] = useState<number>(4750.0);
  const [channel, setChannel] = useState<string>("p2p");
  const [category, setCategory] = useState<string>("money_transfer");
  const [deviceId, setDeviceId] = useState<string>("dev_tor_node");

  // Dynamic Prediction & Receipt State
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [receiptPayload, setReceiptPayload] = useState<any>(null);

  // Initial score
  const handleScore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScoring(true);
    setVerifyResult(null);
    setIsTampered(false);

    try {
      const tx = {
        transaction_id: `tx_${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender_id: senderId,
        receiver_id: receiverId,
        amount: amount,
        currency: "USD",
        channel: channel,
        device_id: deviceId,
        category: category,
      };

      const res = await scoreTransaction(tx);
      setPrediction(res);

      // Use the SERVER's signed receipt payload verbatim. Reconstructing a
      // receipt client-side produces a different payload than the one signed
      // and would fail HMAC verification. The reconstruction below is only a
      // clearly-degraded offline illustration fallback.
      const rcpt = res.audit_receipt || {
        receipt_id: `rcpt_${tx.transaction_id}_${Math.floor(Date.now() / 1000)}`,
        transaction_id: tx.transaction_id,
        timestamp: tx.timestamp,
        model_id: res.model_id,
        model_version: res.model_version,
        calibrated_probability: res.calibrated_probability,
        recommended_action: res.recommended_action,
        financial_cost_estimate: res.expected_fraud_loss,
        top_features: res.top_features,
        sha256_hash: res.audit_receipt_hash,
        signature_algorithm: "SHA256-HMAC",
      };
      setReceiptPayload(rcpt);
    } catch (err: any) {
      console.error(err);
    } finally {
      setScoring(false);
    }
  };

  useEffect(() => {
    // deferred off the render commit (avoids cascading setState in the
    // effect body); mount-only by design — the form has its own submit
    const t = window.setTimeout(() => handleScore(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyPreset = (preset: "mule" | "smurfing" | "legit" | "high_value") => {
    if (preset === "mule") {
      setSenderId("mule_004");
      setReceiverId("mule_001");
      setAmount(2400.0);
      setChannel("p2p");
      setCategory("money_transfer");
      setDeviceId("dev_shared_mule_ring");
    } else if (preset === "smurfing") {
      setSenderId("usr_structuring_bot");
      setReceiverId("merch_crypto_exchange");
      setAmount(4890.0);
      setChannel("p2p");
      setCategory("money_transfer");
      setDeviceId("dev_tor_exit_subnet");
    } else if (preset === "legit") {
      setSenderId("usr_sarah_regular");
      setReceiverId("merch_whole_foods");
      setAmount(64.20);
      setChannel("pos");
      setCategory("groceries");
      setDeviceId("dev_pixel_trusted");
    } else {
      setSenderId("usr_wealth_mgmt");
      setReceiverId("merch_real_estate");
      setAmount(12500.0);
      setChannel("web");
      setCategory("real_estate");
      setDeviceId("dev_macbook_pro_auth");
    }
  };

  const handleVerify = async (tamper: boolean) => {
    if (!receiptPayload) return;
    setVerifying(true);
    try {
      const toSend = { ...receiptPayload };
      if (tamper) {
        toSend.calibrated_probability = 0.001; // Deliberate fraudulent edit
        toSend.recommended_action = "ALLOW";
        setIsTampered(true);
      } else {
        setIsTampered(false);
      }

      const res = await verifyReceipt(toSend);
      setVerifyResult(res);
    } catch (err: any) {
      alert("Verification failed: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = () => {
    if (receiptPayload) {
      navigator.clipboard.writeText(JSON.stringify(receiptPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Plain-English Adverse Action generator
  const generateNarrative = () => {
    if (!prediction) return "";
    const topFeat = prediction.top_features[0]?.feature_name || "velocity";
    if (prediction.recommended_action === "BLOCK") {
      return `Pursuant to FCRA Section 615(a) & ECOA Reg B: Transaction declined due to heightened risk score (${(prediction.calibrated_probability * 100).toFixed(1)}%). Primary contributing factor: anomalous spike in '${topFeat}'. Audit cryptographic proof generated under immutable HMAC key.`;
    } else if (prediction.recommended_action === "REVIEW") {
      return `Transaction queued for Tier-2 fraud analyst inspection. Probability ${(prediction.calibrated_probability * 100).toFixed(1)}% falls within configured operational review band [tau_review, tau_block). Priority investigation queue assigned.`;
    } else if (prediction.recommended_action === "CHALLENGE") {
      return `Automated Step-Up Authentication challenge issued (SMS / Biometric OTP). Calibrated risk ${(prediction.calibrated_probability * 100).toFixed(1)}% indicates moderate uncertainty. Customer friction minimized.`;
    }
    return `Transaction automatically approved under low-risk policy threshold (< tau_allow). Zero customer friction.`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 border-navy-700 text-white shadow-card-ultra">
        <div className="ultra-grid-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-accent-teal/20 text-accent-cyan border border-accent-teal/30">
              <FileCheck2 className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-cyan">
              Responsible AI &amp; Audit Trail
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-white">
            Explainability Explorer <span className="ultra-shimmer-text">&amp; Cryptographic Receipts</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl">
            Complies with GDPR Article 22, ECOA Reg B &amp; EU AI Act high-risk AI governance via exact local TreeSHAP attributions and SHA-256 HMAC cryptographic tokens.
          </p>
        </div>
      </div>

      {/* Dynamic Transaction Scoring Form */}
      <div className="ultra-card ultra-crown p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-navy-700/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-accent-teal dark:text-accent-cyan" />
              <span>Interactive Transaction Scoring Playground</span>
            </h2>
            <p className="text-xs text-slate-400">Input any transaction payload to trigger live TreeSHAP calculation.</p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Presets:</span>
            <button
              onClick={() => handleApplyPreset("mule")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
            >
              Mule Ring
            </button>
            <button
              onClick={() => handleApplyPreset("smurfing")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
            >
              Smurfing
            </button>
            <button
              onClick={() => handleApplyPreset("legit")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              Legit Coffee
            </button>
            <button
              onClick={() => handleApplyPreset("high_value")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-500/10 text-accent-teal border border-blue-500/20 hover:bg-blue-500/20 transition-all"
            >
              High Value
            </button>
          </div>
        </div>

        <form onSubmit={handleScore} className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Sender</label>
            <input
              type="text"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono transition-colors focus:border-accent-teal dark:focus:border-accent-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Receiver</label>
            <input
              type="text"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono transition-colors focus:border-accent-teal dark:focus:border-accent-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono font-bold transition-colors focus:border-accent-teal dark:focus:border-accent-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 transition-colors focus:border-accent-teal dark:focus:border-accent-teal focus:outline-none"
            >
              <option value="mobile">Mobile</option>
              <option value="p2p">P2P</option>
              <option value="web">Web</option>
              <option value="pos">POS</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Device ID</label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono transition-colors focus:border-accent-teal dark:focus:border-accent-teal focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={scoring}
              className="w-full py-1.5 px-3 rounded-lg font-bold bg-accent-teal text-navy-950 hover:bg-accent-cyan flex items-center justify-center space-x-1.5 shadow-glow-teal hover:scale-[1.02] transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{scoring ? "Scoring..." : "Run TreeSHAP"}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="ultra-stagger grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: TreeSHAP Attribution Visualizer */}
        <div className="ultra-card ultra-crown p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-navy-700/60">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                TreeSHAP Local Feature Attribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {prediction ? `Tx #${prediction.transaction_id}` : "Calculating..."}
              </span>
            </div>
            {prediction && (
              <ActionChip action={prediction.recommended_action} probability={prediction.calibrated_probability} />
            )}
          </div>

          {prediction && <ScoreMetric probability={prediction.calibrated_probability} />}

          <div className="space-y-3">
            {prediction && prediction.top_features && prediction.top_features.length > 0 ? (
              prediction.top_features.map((feat, idx) => {
                const isPositive = feat.shap_value > 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {feat.feature_name} = <strong className="text-accent-teal dark:text-accent-cyan">{String(feat.feature_value)}</strong>
                      </span>
                      <span className={`font-bold ${isPositive ? "text-rose-500" : "text-emerald-500"}`}>
                        {isPositive ? `+${feat.shap_value.toFixed(3)}` : feat.shap_value.toFixed(3)}
                      </span>
                    </div>
                    <ShapBar shapValue={feat.shap_value} index={idx} />
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 p-4 text-center">Loading feature attributions...</div>
            )}
          </div>

          {/* Adverse Action Notice Generator */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-navy-700/70 bg-slate-50/80 dark:bg-navy-900/60 text-xs space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <span>Regulatory Adverse Action Narrative</span>
              <span className="text-[10px] text-slate-400 font-normal">(Automated Plain-English)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {generateNarrative()}
            </p>
          </div>
        </div>

        {/* Right Col: Cryptographic Receipt Inspector & Verification Workbench (focal panel) */}
        <div className="ultra-gradient-ring rounded-2xl">
          <div className="ultra-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-navy-700/60">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-accent-teal dark:text-accent-cyan" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cryptographic HMAC-SHA256 Receipt
                </h2>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[220px] border border-slate-700/60 shadow-inner">
              <pre>{receiptPayload ? JSON.stringify(receiptPayload, null, 2) : "Generating receipt..."}</pre>
            </div>

            {/* Live Cryptographic Verification Workbench */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                  <span>Live Tamper-Evidence Workbench:</span>
                  {verifyResult && (
                    <span className={`ultra-chip font-bold ${isTampered ? "text-rose-500" : "text-emerald-500"}`}>
                      {isTampered ? (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="font-mono">{isTampered ? "last payload: TAMPERED" : "last payload: authentic"}</span>
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Calls /api/receipts/verify</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVerify(false)}
                  disabled={verifying}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-[1.02] transition-all text-center flex items-center justify-center space-x-1.5 shadow-glow-emerald disabled:opacity-50 disabled:hover:scale-100"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Authentic</span>
                </button>
                <button
                  onClick={() => handleVerify(true)}
                  disabled={verifying}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 hover:scale-[1.02] transition-all text-center flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Simulate Tamper Edit</span>
                </button>
              </div>

              {verifyResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    verifyResult.status === "VERIFICATION_UNAVAILABLE_OFFLINE"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      : verifyResult.is_valid
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                  }`}
                >
                  <div className="flex items-center">
                    <span
                      className={`ultra-chip font-bold ${
                        verifyResult.status === "VERIFICATION_UNAVAILABLE_OFFLINE"
                          ? "text-amber-500"
                          : verifyResult.is_valid
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      {verifyResult.status === "VERIFICATION_UNAVAILABLE_OFFLINE" ? (
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : verifyResult.is_valid ? (
                        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="font-mono">VERIFICATION RESULT: {verifyResult.status}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {verifyResult.status === "VERIFICATION_UNAVAILABLE_OFFLINE"
                      ? "Verification engine is offline. No authenticity claim can be made without the server-side HMAC key — start the API to verify this receipt."
                      : verifyResult.is_valid
                      ? "Cryptographic HMAC matches exactly. Token payload is guaranteed authentic and untampered."
                      : "HMAC mismatch detected! Calibrated probability or operational action was altered after signing."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
