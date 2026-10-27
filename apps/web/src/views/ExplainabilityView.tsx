import React, { useState, useEffect } from "react";
import { FileCheck2, Fingerprint, ShieldCheck, AlertCircle, Copy, Check, Send, Sparkles, RefreshCw } from "lucide-react";
import { scoreTransaction, verifyReceipt } from "../api";
import { PredictionResult } from "../types";

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

      const rcpt = {
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
    handleScore();
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
      <div className="p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-accent-teal/10 text-accent-teal">
            <FileCheck2 className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-teal">
            Responsible AI &amp; Audit Trail
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
          Explainability Explorer &amp; Cryptographic Receipts
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Complies with GDPR Article 22, ECOA Reg B &amp; EU AI Act high-risk AI governance via exact local TreeSHAP attributions and SHA-256 HMAC cryptographic tokens.
        </p>
      </div>

      {/* Dynamic Transaction Scoring Form */}
      <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-navy-700">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-accent-teal" />
              <span>Interactive Transaction Scoring Playground</span>
            </h2>
            <p className="text-xs text-slate-400">Input any transaction payload to trigger live TreeSHAP calculation.</p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Presets:</span>
            <button
              onClick={() => handleApplyPreset("mule")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
            >
              Mule Ring
            </button>
            <button
              onClick={() => handleApplyPreset("smurfing")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
            >
              Smurfing
            </button>
            <button
              onClick={() => handleApplyPreset("legit")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
            >
              Legit Coffee
            </button>
            <button
              onClick={() => handleApplyPreset("high_value")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-500/10 text-accent-teal border border-blue-500/20 hover:bg-blue-500/20"
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
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Receiver</label>
            <input
              type="text"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700"
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
              className="w-full px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={scoring}
              className="w-full py-1.5 px-3 rounded-lg font-bold bg-accent-teal text-navy-950 hover:bg-accent-cyan flex items-center justify-center space-x-1.5 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{scoring ? "Scoring..." : "Run TreeSHAP"}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: TreeSHAP Attribution Visualizer */}
        <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                TreeSHAP Local Feature Attribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {prediction ? `Tx #${prediction.transaction_id}` : "Calculating..."}
              </span>
            </div>
            {prediction && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  prediction.recommended_action === "BLOCK"
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : prediction.recommended_action === "REVIEW"
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : prediction.recommended_action === "CHALLENGE"
                    ? "bg-blue-500/10 text-accent-teal border border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                }`}
              >
                ACTION: {prediction.recommended_action} ({(prediction.calibrated_probability * 100).toFixed(1)}%)
              </span>
            )}
          </div>

          <div className="space-y-3">
            {prediction && prediction.top_features && prediction.top_features.length > 0 ? (
              prediction.top_features.map((feat, idx) => {
                const isPositive = feat.shap_value > 0;
                const widthPct = Math.min(100, Math.max(8, Math.abs(feat.shap_value) * 180));

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {feat.feature_name} = <strong className="text-accent-teal">{String(feat.feature_value)}</strong>
                      </span>
                      <span className={`font-bold ${isPositive ? "text-rose-500" : "text-emerald-500"}`}>
                        {isPositive ? `+${feat.shap_value.toFixed(3)}` : feat.shap_value.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${isPositive ? "bg-rose-500" : "bg-emerald-500"}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 p-4 text-center">Loading feature attributions...</div>
            )}
          </div>

          {/* Adverse Action Notice Generator */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 text-xs space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <span>Regulatory Adverse Action Narrative</span>
              <span className="text-[10px] text-slate-400 font-normal">(Automated Plain-English)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {generateNarrative()}
            </p>
          </div>
        </div>

        {/* Right Col: Cryptographic Receipt Inspector & Verification Workbench */}
        <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
            <div className="flex items-center space-x-2">
              <Fingerprint className="w-4 h-4 text-accent-teal" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Cryptographic HMAC-SHA256 Receipt
              </h2>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[220px]">
            <pre>{receiptPayload ? JSON.stringify(receiptPayload, null, 2) : "Generating receipt..."}</pre>
          </div>

          {/* Live Cryptographic Verification Workbench */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Live Tamper-Evidence Workbench:</span>
              <span className="text-[10px] text-slate-400">Calls /api/receipts/verify</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVerify(false)}
                disabled={verifying}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-center flex items-center justify-center space-x-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Authentic</span>
              </button>
              <button
                onClick={() => handleVerify(true)}
                disabled={verifying}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-center flex items-center justify-center space-x-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Simulate Tamper Edit</span>
              </button>
            </div>

            {verifyResult && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  verifyResult.is_valid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold">
                  {verifyResult.is_valid ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>VERIFICATION RESULT: {verifyResult.status}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {verifyResult.is_valid
                    ? "Cryptographic HMAC matches exactly. Token payload is guaranteed authentic and untampered."
                    : "HMAC mismatch detected! Calibrated probability or operational action was altered after signing."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
