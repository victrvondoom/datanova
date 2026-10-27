import React, { useState } from "react";
import { FileCheck2, Fingerprint, ShieldCheck, AlertCircle, Copy, Check } from "lucide-react";

export const ExplainabilityView: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [tampered, setTampered] = useState<boolean>(false);

  const sampleReceipt = {
    receipt_id: "rcpt_tx_0000420_1761567890",
    transaction_id: "tx_0000420",
    timestamp: "2026-10-27T11:45:00.000Z",
    model_id: "lightgbm_graph_champion",
    model_version: "1.2.0",
    calibrated_probability: 0.8842,
    recommended_action: "BLOCK",
    financial_cost_estimate: 2450.0,
    top_features: [
      { feature_name: "tx_count_1h", feature_value: 4.0, shap_value: 0.421, importance_rank: 1 },
      { feature_name: "graph_cycle_detected", feature_value: 1.0, shap_value: 0.385, importance_rank: 2 },
      { feature_name: "amount_ratio_24h", feature_value: 5.82, shap_value: 0.294, importance_rank: 3 },
      { feature_name: "distinct_devices_24h", feature_value: 2.0, shap_value: 0.178, importance_rank: 4 },
      { feature_name: "is_weekend", feature_value: 1.0, shap_value: -0.042, importance_rank: 5 },
    ],
    sha256_hash: "a4f89d34e2c8901b0f56d78a9c1e345b67890abcdef1234567890abcdef12345",
    signature_algorithm: "SHA256-HMAC",
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleReceipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          Complies with GDPR Article 22 &amp; EU AI Act high-risk AI standards via exact TreeSHAP attributions and SHA-256 HMAC tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: TreeSHAP Attribution Visualizer */}
        <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                TreeSHAP Local Feature Attribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">Case #{sampleReceipt.transaction_id}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
              ACTION: BLOCK
            </span>
          </div>

          <div className="space-y-3">
            {sampleReceipt.top_features.map((feat, idx) => {
              const isPositive = feat.shap_value > 0;
              const widthPct = Math.min(100, Math.abs(feat.shap_value) * 180);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {feat.feature_name} = <strong className="text-accent-teal">{feat.feature_value}</strong>
                    </span>
                    <span className={`font-bold ${isPositive ? "text-rose-500" : "text-emerald-500"}`}>
                      {isPositive ? `+${feat.shap_value.toFixed(3)}` : feat.shap_value.toFixed(3)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${isPositive ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Adverse Action Notice Generator */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 text-xs space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <span>Regulatory Adverse Action Narrative</span>
              <span className="text-[10px] text-slate-400 font-normal">(Automated Plain-English)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              &ldquo;This payment was declined due to rapid transaction velocity in the past 1 hour (4 attempts),
              a detected directed circular transfer sequence closing an account cycle, and an amount exceeding 5.8x your
              rolling 24-hour baseline average.&rdquo;
            </p>
          </div>
        </div>

        {/* Right Col: Cryptographic Tamper-Evident Receipt */}
        <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-accent-teal" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cryptographic Audit Receipt (HMAC-SHA256)
                </h2>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>

            {/* Code Block Receipt */}
            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[320px] mt-3">
              {JSON.stringify(
                {
                  ...sampleReceipt,
                  calibrated_probability: tampered ? 0.05 : sampleReceipt.calibrated_probability,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Tamper Test Sandbox */}
          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                {tampered ? (
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                <span>{tampered ? "INVALID SIGNATURE (Tampering Detected)" : "DIGEST VERIFIED & VALID"}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {tampered
                  ? "Receipt modified after generation! Hash mismatch."
                  : "Signed with HMAC-SHA256. Guaranteed authentic."}
              </p>
            </div>
            <button
              onClick={() => setTampered(!tampered)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tampered
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20"
              }`}
            >
              {tampered ? "Restore Original" : "Simulate Tampering"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
