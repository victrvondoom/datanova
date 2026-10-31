export type OperationalAction = "ALLOW" | "CHALLENGE" | "REVIEW" | "BLOCK";

export interface FeatureContribution {
  feature_name: string;
  feature_value: any;
  shap_value: number;
  importance_rank: number;
}

export interface Transaction {
  transaction_id: string;
  timestamp: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  channel: string;
  device_id?: string;
  ip_address?: string;
  location?: string;
  category?: string;
  is_fraud?: number;
}

export interface PredictionResult {
  degraded?: boolean;
  source?: string;
  transaction_id: string;
  calibrated_probability: number;
  raw_score: number;
  recommended_action: OperationalAction;
  policy_name: string;
  model_id: string;
  model_version: string;
  inference_latency_ms: number;
  expected_fraud_loss: number;
  expected_cost: number;
  top_features: FeatureContribution[];
  audit_receipt_hash?: string;
  /** Server-signed receipt payload; verify this verbatim. */
  audit_receipt?: any;
  /** True when this response replays a previously stored decision. */
  idempotent_replay?: boolean;
}

export interface ReplayRecord {
  transaction: Transaction;
  aegis_result: PredictionResult;
  baseline_action: string;
  baseline_cost: number;
  aegis_cost: number;
  ground_truth_fraud: number;
}

export interface ReplayBatchResponse {
  batch_offset: number;
  batch_count: number;
  total_available: number;
  /** True when the payload is a client-side offline fallback, not live API data. */
  degraded?: boolean;
  source?: string;
  cumulative_summary: {
    baseline_total_cost: number;
    aegis_total_cost: number;
    net_dollar_savings: number;
    savings_percentage: number;
  };
  records: ReplayRecord[];
}

export interface BenchmarkMetrics {
  pr_auc: number;
  roc_auc: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  recall_at_fpr_1pct: number;
  brier_score: number;
  expected_calibration_error: number;
  inference_latency_ms_per_tx: number;
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
  financial_outcomes: {
    uncaught_fraud_loss: number;
    investigation_labor_cost: number;
    customer_friction_cost: number;
    total_operational_cost: number;
    baseline_cost_no_detection: number;
    estimated_net_savings: number;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  risk_score: number;
  in_degree: number;
  out_degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
}

export interface SubgraphResponse {
  degraded?: boolean;
  source?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
}
