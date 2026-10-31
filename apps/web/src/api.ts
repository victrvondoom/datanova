import { ReplayBatchResponse, SubgraphResponse, PredictionResult } from "./types";

const CANDIDATE_PORTS = [8002, 8000, 8001];
let detectedPort = 8002;

export function getApiBase() {
  return `http://127.0.0.1:${detectedPort}/api`;
}

export async function checkHealth() {
  for (const port of CANDIDATE_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data.service && data.service.includes("AEGIS")) {
          detectedPort = port;
          return data;
        }
      }
    } catch {
      // try next port
    }
  }
  return { status: "offline", model_id: "AEGIS-LightGBM-Graph-v1.2", active_policy: { policy_name: "Cost-Aware-Optimized" } };
}

export async function fetchBenchmarks() {
  try {
    const res = await fetch(`${getApiBase()}/benchmarks`);
    if (!res.ok) throw new Error("Benchmarks failed");
    return await res.json();
  } catch {
    // Offline fallback to the last measured benchmark run (2026-10-31 protocol).
    // `degraded: true` marks this as a stale snapshot, not a live measurement.
    return {
      degraded: true,
      source: "offline-fallback",
      champion_model_name: "XGBoost",
      champion_confidence_intervals_95: {
        pr_auc: { mean: 0.7169, ci_lower: 0.5912, ci_upper: 0.8294 },
        roc_auc: { mean: 0.9916, ci_lower: 0.9863, ci_upper: 0.9961 }
      },
      benchmark_summary: {
        "Rule-Based Heuristic": { pr_auc: 0.0949, roc_auc: 0.6092, recall_at_fpr_1pct: 0.1245, brier_score: 0.0198, inference_latency_ms_per_tx: 0.001, financial_outcomes: { total_operational_cost: 35750.07, estimated_net_savings: 2827.76 } },
        "Logistic Regression": { pr_auc: 0.4509, roc_auc: 0.9646, recall_at_fpr_1pct: 0.4303, brier_score: 0.0143, inference_latency_ms_per_tx: 0.0, financial_outcomes: { total_operational_cost: 27844.57, estimated_net_savings: 10733.26 } },
        "Random Forest": { pr_auc: 0.7190, roc_auc: 0.9783, recall_at_fpr_1pct: 0.6724, brier_score: 0.0096, inference_latency_ms_per_tx: 0.013, financial_outcomes: { total_operational_cost: 9581.30, estimated_net_savings: 28996.53 } },
        "LightGBM (Tabular)": { pr_auc: 0.7240, roc_auc: 0.9891, recall_at_fpr_1pct: 0.6887, brier_score: 0.0086, inference_latency_ms_per_tx: 0.002, financial_outcomes: { total_operational_cost: 5960.88, estimated_net_savings: 32616.95 } },
        "XGBoost": { pr_auc: 0.7147, roc_auc: 0.9915, recall_at_fpr_1pct: 0.7141, brier_score: 0.0091, inference_latency_ms_per_tx: 0.001, financial_outcomes: { total_operational_cost: 7442.83, estimated_net_savings: 31135.00 } },
        "AEGIS LightGBM + Graph": { pr_auc: 0.7667, roc_auc: 0.9905, recall_at_fpr_1pct: 0.7753, brier_score: 0.0082, inference_latency_ms_per_tx: 0.002, financial_outcomes: { total_operational_cost: 5940.88, estimated_net_savings: 32636.95 } }
      },
      policy_comparisons: {
        fixed_threshold_baseline: { policy: { policy_name: "Fixed-Threshold (p>=0.5)", tau_allow: 0.5, tau_review: 0.5, tau_block: 0.5 }, metrics: { false_positive_rate: 0.00102, total_cost: 7107.83, estimated_savings: 31470.00, savings_ratio: 0.8158 } },
        conservative_baseline: { policy: { policy_name: "Conservative Heuristic", tau_allow: 0.3, tau_review: 0.7, tau_block: 0.95 }, metrics: { false_positive_rate: 0.00102, total_cost: 7107.83, estimated_savings: 31470.00, savings_ratio: 0.8158 } },
        aegis_cost_optimized: { policy: { policy_name: "Cost-Aware-Optimized", tau_allow: 0.2222, tau_review: 1.0, tau_block: 1.0 }, metrics: { false_positive_rate: 0.00204, total_cost: 5376.27, estimated_savings: 33201.56, savings_ratio: 0.8606 } }
      }
    };
  }
}

export async function fetchReplayBatch(offset: number = 0, limit: number = 30): Promise<ReplayBatchResponse> {
  try {
    const res = await fetch(`${getApiBase()}/stream/replay-batch?offset=${offset}&limit=${limit}`);
    if (!res.ok) throw new Error("Replay batch failed");
    return await res.json();
  } catch {
    // Generate realistic client fallback replay records
    const records = Array.from({ length: limit }).map((_, i) => {
      const idx = offset + i;
      const isFraud = idx % 35 === 0 ? 1 : 0;
      const amount = isFraud ? 1450.0 + (idx % 8) * 200 : 45.0 + (idx % 20) * 15;
      const prob = isFraud ? 0.88 : (idx % 7 === 0 ? 0.22 : 0.02);
      const action = prob < 0.15 ? "ALLOW" : (prob < 0.45 ? "CHALLENGE" : (prob < 0.75 ? "REVIEW" : "BLOCK"));
      const baselineAct = prob >= 0.5 ? "BLOCK" : "ALLOW";
      return {
        transaction: {
          transaction_id: `tx_${idx.toString().padStart(7, "0")}`,
          timestamp: new Date(Date.now() - (1000 - idx) * 30000).toISOString(),
          sender_id: isFraud ? "mule_004" : `usr_${(idx % 150).toString().padStart(4, "0")}`,
          receiver_id: isFraud ? "mule_001" : `merch_${(idx % 40).toString().padStart(3, "0")}`,
          amount,
          currency: "USD",
          channel: isFraud ? "p2p" : "mobile",
          device_id: isFraud ? "dev_guest_892" : "dev_primary",
          category: isFraud ? "money_transfer" : "retail",
          is_fraud: isFraud,
        },
        aegis_result: {
          transaction_id: `tx_${idx.toString().padStart(7, "0")}`,
          calibrated_probability: prob,
          raw_score: prob * 1.05,
          recommended_action: action as any,
          policy_name: "Cost-Aware-Optimized",
          model_id: "lightgbm_graph_champion",
          model_version: "1.2.0",
          inference_latency_ms: 0.02,
          expected_fraud_loss: isFraud ? amount * prob : 0,
          expected_cost: isFraud ? 15.0 : 0.0,
          top_features: [
            { feature_name: "tx_count_1h", feature_value: isFraud ? 4 : 1, shap_value: isFraud ? 0.42 : -0.15, importance_rank: 1 },
            { feature_name: "graph_cycle_detected", feature_value: isFraud ? 1 : 0, shap_value: isFraud ? 0.38 : 0, importance_rank: 2 },
            { feature_name: "amount_ratio_24h", feature_value: isFraud ? 6.2 : 1.1, shap_value: isFraud ? 0.29 : -0.05, importance_rank: 3 }
          ],
          audit_receipt_hash: "a4f89d34e2c8901b0f56d78a9c1e345b67890abcdef1234567890abcdef12345"
        },
        baseline_action: baselineAct,
        baseline_cost: baselineAct === "BLOCK" && isFraud === 0 ? 25.0 : (baselineAct === "ALLOW" && isFraud === 1 ? amount : 0),
        aegis_cost: action === "BLOCK" && isFraud === 0 ? 25.0 : (action === "ALLOW" && isFraud === 1 ? amount : (action === "REVIEW" ? 15.0 : 0.1)),
        ground_truth_fraud: isFraud
      };
    });

    return {
      batch_offset: offset,
      batch_count: limit,
      total_available: 3000,
      degraded: true,
      source: "offline-fallback",
      cumulative_summary: {
        baseline_total_cost: 5650.0,
        aegis_total_cost: 3060.0,
        net_dollar_savings: 2590.0,
        savings_percentage: 45.8
      },
      records
    };
  }
}

export async function fetchGraphSubgraph(): Promise<SubgraphResponse> {
  try {
    const res = await fetch(`${getApiBase()}/graph/subgraph?limit_nodes=35`);
    if (!res.ok) throw new Error("Subgraph fetch failed");
    return await res.json();
  } catch {
    // Deterministic fallback graph with mule rings
    const nodes = [
      { id: "mule_001", label: "Mule Ring Alpha (Node 1)", type: "mule_account", risk_score: 0.94, in_degree: 3, out_degree: 2 },
      { id: "mule_002", label: "Mule Ring Alpha (Node 2)", type: "mule_account", risk_score: 0.91, in_degree: 2, out_degree: 3 },
      { id: "mule_003", label: "Mule Ring Alpha (Node 3)", type: "mule_account", risk_score: 0.89, in_degree: 3, out_degree: 1 },
      { id: "mule_004", label: "Mule Ring Alpha (Node 4)", type: "mule_account", risk_score: 0.95, in_degree: 1, out_degree: 4 },
      { id: "cashout_exchange", label: "Offshore Crypto Gateway", type: "merchant", risk_score: 0.82, in_degree: 8, out_degree: 0 },
      { id: "usr_0012", label: "Legit Account (Alice)", type: "account", risk_score: 0.04, in_degree: 0, out_degree: 3 },
      { id: "usr_0089", label: "Legit Account (Bob)", type: "account", risk_score: 0.02, in_degree: 1, out_degree: 2 },
      { id: "merch_amazon", label: "Amazon Retailer", type: "merchant", risk_score: 0.05, in_degree: 15, out_degree: 0 },
      { id: "merch_starbucks", label: "Starbucks Coffee", type: "merchant", risk_score: 0.01, in_degree: 22, out_degree: 0 },
      { id: "dev_compromised", label: "Shared Device (Tor Exit)", type: "device", risk_score: 0.98, in_degree: 0, out_degree: 4 }
    ];
    const edges = [
      { source: "mule_001", target: "mule_002", amount: 2400.0 },
      { source: "mule_002", target: "mule_003", amount: 2350.0 },
      { source: "mule_003", target: "mule_004", amount: 2300.0 },
      { source: "mule_004", target: "mule_001", amount: 2250.0 }, // Circular mule flow!
      { source: "mule_004", target: "cashout_exchange", amount: 8900.0 },
      { source: "usr_0012", target: "merch_amazon", amount: 84.50 },
      { source: "usr_0089", target: "merch_starbucks", amount: 12.75 },
      { source: "usr_0012", target: "merch_starbucks", amount: 9.50 },
    ];
    return {
      nodes,
      edges,
      total_nodes: 35,
      total_edges: 48,
      degraded: true,
      source: "offline-fallback",
    };
  }
}

export async function optimizePolicy(params: {
  investigation_cost: number;
  customer_friction_cost: number;
  friction_block_cost: number;
  max_fpr: number;
  review_capacity_daily: number;
}) {
  try {
    const res = await fetch(`${getApiBase()}/optimize-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Policy optimization failed");
    return await res.json();
  } catch {
    // Dynamic recalculation fallback
    const allow = Math.max(0.05, Math.min(0.25, 0.15 * (params.investigation_cost / 15)));
    const review = Math.max(0.30, Math.min(0.60, 0.42 * (params.review_capacity_daily / 100)));
    const block = Math.max(0.70, Math.min(0.95, 0.75 + (params.friction_block_cost / 100)));
    return {
      status: "success",
      degraded: true,
      source: "offline-fallback",
      active_policy: { policy_name: "Cost-Aware-Optimized", tau_allow: allow, tau_review: review, tau_block: block },
      comparisons: {
        fixed_threshold_baseline: { policy: { policy_name: "Fixed-Threshold (p>=0.5)", tau_allow: 0.5, tau_review: 0.5, tau_block: 0.5 }, metrics: { false_positive_rate: 0.00102, total_cost: 7107.83, estimated_savings: 31470.00, savings_ratio: 0.8158 } },
        aegis_cost_optimized: { policy: { policy_name: "Cost-Aware-Optimized", tau_allow: allow, tau_review: review, tau_block: block }, metrics: { false_positive_rate: 0.00204, total_cost: 5376.27, estimated_savings: 33201.56, savings_ratio: 0.8606 } }
      }
    };
  }
}

export async function evaluateDrift() {
  try {
    const res = await fetch(`${getApiBase()}/drift/evaluate`, { method: "POST" });
    if (!res.ok) throw new Error("Drift check failed");
    return await res.json();
  } catch {
    return {
      status: "STABLE",
      degraded: true,
      source: "offline-fallback",
      amount_psi: 0.0342,
      amount_wasserstein_distance: 14.82,
      alert_level: "GREEN",
      reference_window: "Baseline Fold (First 1,000 tx)",
      monitoring_window: "Streaming Window (Next 1,000 tx)",
      action_required: false
    };
  }
}

export async function scoreTransaction(tx: any): Promise<PredictionResult> {
  try {
    const res = await fetch(`${getApiBase()}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error("Score request failed");
    return await res.json();
  } catch {
    // NOTE: offline fallback is a heuristic ILLUSTRATION, not model inference.
    const isHigh = tx.amount > 1000 || (tx.channel === "p2p" && tx.amount > 500);
    const prob = isHigh ? 0.84 : 0.03;
    const action = prob < 0.15 ? "ALLOW" : (prob < 0.45 ? "CHALLENGE" : (prob < 0.75 ? "REVIEW" : "BLOCK"));
    return {
      degraded: true,
      source: "offline-fallback",
      transaction_id: tx.transaction_id || `tx_fallback_${Date.now()}`,
      calibrated_probability: prob,
      raw_score: prob * 1.04,
      recommended_action: action as any,
      policy_name: "Cost-Aware-Optimized",
      model_id: "lightgbm_graph_champion",
      model_version: "1.2.0",
      inference_latency_ms: 0.03,
      expected_fraud_loss: tx.amount * prob,
      expected_cost: isHigh ? 15.0 : 0.0,
      top_features: [
        { feature_name: "amount_zscore_user", feature_value: tx.amount > 500 ? 3.4 : 0.2, shap_value: isHigh ? 0.41 : -0.12, importance_rank: 1 },
        { feature_name: "channel_p2p", feature_value: tx.channel === "p2p" ? 1 : 0, shap_value: tx.channel === "p2p" ? 0.35 : -0.05, importance_rank: 2 },
        { feature_name: "graph_cycle_detected", feature_value: 0, shap_value: 0.0, importance_rank: 3 }
      ],
      audit_receipt_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    };
  }
}

export async function injectTransaction(req: {
  sender_id: string;
  receiver_id: string;
  amount: number;
  channel: string;
  device_id?: string;
  category?: string;
  is_fraud_simulated: number;
}) {
  try {
    const res = await fetch(`${getApiBase()}/stream/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error("Injection failed");
    return await res.json();
  } catch {
    const now = new Date().toISOString();
    const isFraud = req.is_fraud_simulated;
    const prob = isFraud ? 0.91 : 0.04;
    const action = prob < 0.15 ? "ALLOW" : (prob < 0.45 ? "CHALLENGE" : (prob < 0.75 ? "REVIEW" : "BLOCK"));
    const txId = `inject_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;
    return {
      status: "injected",
      degraded: true,
      source: "offline-fallback",
      transaction: {
        transaction_id: txId,
        timestamp: now,
        sender_id: req.sender_id,
        receiver_id: req.receiver_id,
        amount: req.amount,
        currency: "USD",
        channel: req.channel,
        device_id: req.device_id || "dev_inject",
        category: req.category || "retail",
        is_fraud: req.is_fraud_simulated,
      },
      score_result: {
        transaction_id: txId,
        calibrated_probability: prob,
        raw_score: prob * 1.05,
        recommended_action: action as any,
        policy_name: "Cost-Aware-Optimized",
        model_id: "lightgbm_graph_champion",
        model_version: "1.2.0",
        inference_latency_ms: 0.04,
        expected_fraud_loss: req.amount * prob,
        expected_cost: isFraud ? 15.0 : 0.0,
        top_features: [
          { feature_name: "amount", feature_value: req.amount, shap_value: isFraud ? 0.44 : -0.1, importance_rank: 1 },
          { feature_name: "graph_cycle_detected", feature_value: isFraud ? 1 : 0, shap_value: isFraud ? 0.38 : 0, importance_rank: 2 },
        ],
        audit_receipt_hash: "f1a23b45c6789def0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    };
  }
}

export async function simulateStress(scenario: "smurfing" | "spoofing" | "volume_surge" | "none") {
  try {
    const res = await fetch(`${getApiBase()}/drift/simulate-stress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) throw new Error("Stress simulation failed");
    return await res.json();
  } catch {
    if (scenario === "smurfing") {
      return {
        status: "CRITICAL_DRIFT",
        degraded: true,
        source: "offline-fallback",
        alert_level: "RED",
        scenario: "smurfing",
        scenario_description: "Adversarial Smurfing / Structuring ($4,500 - $4,890 to bypass $5k rule checks)",
        amount_psi: 0.3842,
        amount_wasserstein_distance: 1420.50,
        action_required: true,
        recommendation: "Automatic policy threshold adaptation triggered. Step-up OTP challenges active."
      };
    } else if (scenario === "spoofing") {
      return {
        status: "WARNING_MODERATE_DRIFT",
        degraded: true,
        source: "offline-fallback",
        alert_level: "AMBER",
        scenario: "spoofing",
        scenario_description: "Rapid Device Fingerprint Spoofing & Tor Proxy Subnet Proliferation",
        amount_psi: 0.1654,
        amount_wasserstein_distance: 430.15,
        action_required: true,
        recommendation: "Device velocity damping activated. Additional 2FA challenge on new browser fingerprints."
      };
    } else {
      return {
        status: "STABLE",
        degraded: true,
        source: "offline-fallback",
        alert_level: "GREEN",
        scenario: "none",
        scenario_description: "Clean Baseline Stationary Stream",
        amount_psi: 0.0245,
        amount_wasserstein_distance: 12.40,
        action_required: false,
        recommendation: "System stationary. Normal operational thresholds active."
      };
    }
  }
}

export async function verifyReceipt(receipt: any) {
  try {
    const res = await fetch(`${getApiBase()}/receipts/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt }),
    });
    if (!res.ok) throw new Error("Verify receipt failed");
    return await res.json();
  } catch {
    // Cryptographic verification is ONLY performed server-side. Offline we
    // must never claim a receipt is authentic: report the verification as
    // unavailable rather than fabricating a validity verdict.
    return {
      receipt_id: receipt?.receipt_id || "rcpt_unknown",
      is_valid: false,
      signature_algorithm: "SHA256-HMAC",
      sha256_hash: receipt?.sha256_hash || "",
      status: "VERIFICATION_UNAVAILABLE_OFFLINE",
      degraded: true,
      source: "offline-fallback",
    };
  }
}

