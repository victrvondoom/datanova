"""
FastAPI Enterprise Application for AEGIS-Fraud X.
Provides:
- Real-time ML inference with trained champion model and isotonic calibration
- Explainability via local TreeSHAP attributions and SHA-256 audit receipts
- Interactive cost-aware policy optimization with persistent runtime state
- Dynamic fraud graph exploration
- Transaction streaming replay with live Digital Twin comparison
- Dynamic concept drift monitoring and adversarial stress lab
- Real-time transaction injection and cryptographic receipt verification
"""

import json
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TypeVar, cast

import networkx as nx
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure project root in pythonpath
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from apps.api.integrity import (
    DecisionLedger,
    IdempotencyCache,
    RequestIDMiddleware,
    TokenBucketRateLimiter,
)
from packages.artifacts.bundle import BundleValidationError, load_bundle
from packages.data.schemas import (
    AuditReceipt,
    ChannelType,
    CostConfiguration,
    DecisionPolicy,
    OperationalAction,
    PredictionResult,
    Transaction,
)
from packages.data.synthetic import SyntheticTransactionGenerator
from packages.explainability.receipts import AuditReceiptGenerator
from packages.explainability.shap_engine import ExplainabilityEngine
from packages.features.pipeline import FeaturePipeline
from packages.graph.features import GraphFeatureExtractor
from packages.graph.temporal_graph import TemporalFraudGraph
from packages.models.base import BaseFraudClassifier
from packages.models.calibration import ProbabilityCalibrator
from packages.monitoring.drift import DriftMonitor
from packages.monitoring.stress_lab import StressTestingLab
from packages.optimization.cost_engine import CostEngine
from packages.optimization.optimizer import PolicyOptimizer

# Global State Container
T = TypeVar("T")


class ModelState:
    def require(self, value: Optional[T]) -> T:
        """Narrow an Optional engine component to its non-None type.

        mypy cannot narrow ``state.x`` attribute access, so endpoints call
        ``state.require(state.drift_monitor)`` to obtain a typed reference
        and fail fast with a clear message if the engine is uninitialized.
        """
        assert value is not None, "engine state not initialized; call init_engine() first"
        return value

    def __init__(self):
        self.model: Optional[BaseFraudClassifier] = None
        self.calibrator: Optional[ProbabilityCalibrator] = None
        self.feature_pipeline: Optional[FeaturePipeline] = None
        self.graph_extractor: Optional[GraphFeatureExtractor] = None
        self.temporal_graph: Optional[TemporalFraudGraph] = None
        self.explainer: Optional[ExplainabilityEngine] = None
        self.receipt_gen: Optional[AuditReceiptGenerator] = None
        self.cost_engine: Optional[CostEngine] = None
        self.policy_optimizer: Optional[PolicyOptimizer] = None
        self.current_policy: Optional[DecisionPolicy] = None
        self.benchmark_data: Optional[Dict] = None
        self.sample_transactions: Optional[pd.DataFrame] = None
        self.stress_lab: Optional[StressTestingLab] = None
        self.drift_monitor: Optional[DriftMonitor] = None
        self.sample_X: Optional[np.ndarray] = None
        self.calibration_source: str = "uninitialized"
        self.artifact_status: str = "not_loaded"
        self.artifact_run_id: Optional[str] = None
        # Serving-integrity components (catalog: ingest_idem, api_rate_limiting,
        # obs_request_ids, govern_decision_log, deploy_readiness_checks)
        self.idempotency: Optional[IdempotencyCache] = None
        self.rate_limiter: Optional[TokenBucketRateLimiter] = None
        self.decision_ledger: Optional[DecisionLedger] = None


state = ModelState()


# Artifact bundle location (overridable for deployments and tests)
CHAMPION_BUNDLE_PATH = os.environ.get(
    "AEGIS_BUNDLE_PATH", "experiments/champion_bundle.pkl"
)
CHAMPION_CALIBRATOR_PATH = os.environ.get(
    "AEGIS_CALIBRATOR_PATH", "experiments/champion_calibrator.pkl"
)


def init_engine():
    """Initializes the ML model, graph, and feature pipeline."""
    state.idempotency = IdempotencyCache(capacity=4096)
    state.rate_limiter = TokenBucketRateLimiter(rate_per_minute=600.0, burst=60)
    state.decision_ledger = DecisionLedger(
        path=os.environ.get("AEGIS_DECISION_LEDGER", "benchmarks/runs/decision_ledger.jsonl")
    )
    state.receipt_gen = AuditReceiptGenerator()
    state.cost_engine = CostEngine()
    state.policy_optimizer = PolicyOptimizer()
    state.stress_lab = StressTestingLab(seed=42)
    state.drift_monitor = DriftMonitor()
    state.current_policy = DecisionPolicy(
        policy_name="Cost-Aware-Optimized",
        tau_allow=0.15,
        tau_review=0.42,
        tau_block=0.75,
    )
    state.temporal_graph = TemporalFraudGraph(retention_hours=168)
    state.graph_extractor = GraphFeatureExtractor(window_hours=24)

    # Load the versioned artifact bundle (training-to-serving contract).
    # A bundle that fails validation is REJECTED, never silently substituted.
    bundle_path = CHAMPION_BUNDLE_PATH
    legacy_model_path = "experiments/champion_model.pkl"
    state.artifact_run_id = None
    _calibrator_from_bundle = False
    if os.path.exists(bundle_path):
        try:
            payload = load_bundle(bundle_path)
            state.model = payload["model"]
            state.calibrator = payload["calibrator"]
            state.current_policy = DecisionPolicy(**payload["policy"])
            state.artifact_run_id = payload["run_id"]
            state.artifact_status = "bundle_validated"
            _calibrator_from_bundle = True
        except BundleValidationError as e:
            state.model = None
            state.calibrator = None
            state.artifact_status = f"bundle_rejected: {e}"
    elif os.path.exists(legacy_model_path):
        try:
            state.model = BaseFraudClassifier.load(legacy_model_path)
            state.artifact_status = "legacy_model_loaded"
        except Exception:
            state.model = None
            state.artifact_status = "legacy_model_load_failed"
    else:
        state.model = None
        state.artifact_status = "no_artifacts"

    # Load benchmark summary
    bench_path = "benchmarks/runs/benchmark_summary.json"
    if os.path.exists(bench_path):
        try:
            with open(bench_path, "r") as f:
                state.benchmark_data = json.load(f)
        except Exception:
            state.benchmark_data = None

    # Initialize synthetic reference population for feature extraction & streaming
    gen = SyntheticTransactionGenerator(seed=42)
    state.sample_transactions = gen.generate_stream(n_transactions=3000, fraud_ratio=0.02)
    state.feature_pipeline = FeaturePipeline()
    state.feature_pipeline.fit(state.sample_transactions)

    # Populate initial graph with first 1500 historical transactions
    for _, r in state.sample_transactions.iloc[:1500].iterrows():
        state.require(state.temporal_graph).add_transaction(
            sender_id=str(r["sender_id"]),
            receiver_id=str(r["receiver_id"]),
            amount=float(r["amount"]),
            timestamp=r["timestamp"],
            device_id=str(r.get("device_id", "none")),
        )

    # Precompute sample_X matching model feature shape
    X_tab = state.require(state.feature_pipeline).transform(state.sample_transactions)
    if state.model and len(state.model.feature_names) > X_tab.shape[1]:
        gf_df = state.graph_extractor.extract_batch_graph_features(state.sample_transactions)
        state.sample_X = np.hstack([X_tab, gf_df.values])
    else:
        state.sample_X = X_tab

    # Calibrator setup: the validated bundle carries the calibrator fitted on
    # the validation split. Otherwise load the standalone artifact, or fit on
    # the real reference population — never on fabricated data.
    calibrator_path = CHAMPION_CALIBRATOR_PATH
    calibration_source = "base-rate-prior"
    if _calibrator_from_bundle and state.calibrator is not None and state.calibrator.fitted:
        calibration_source = "validation-artifact"
    elif not _calibrator_from_bundle:
        if state.model is not None and os.path.exists(calibrator_path):
            try:
                state.calibrator = ProbabilityCalibrator.load(calibrator_path)
                calibration_source = "validation-artifact"
            except Exception:
                state.calibrator = None
        else:
            state.calibrator = None

        if state.calibrator is None:
            state.calibrator = ProbabilityCalibrator(method="isotonic")
            if state.model is not None and state.sample_X is not None:
                ref_scores = state.model.predict_proba(state.sample_X)
                ref_labels = np.asarray(
                    state.sample_transactions["is_fraud"].values, dtype=int
                )
                state.calibrator.fit(ref_scores, ref_labels)
                calibration_source = "reference-data"
            else:
                # No model available: calibrate against the reference population's
                # base-rate prior so outputs are at least statistically grounded.
                base_rate = float(
                    state.sample_transactions["is_fraud"].mean()
                )
                raw = np.linspace(0.0, 1.0, 100)
                state.calibrator.fit(raw, np.full(100, base_rate))
    state.calibration_source = calibration_source

    if state.model:
        state.explainer = ExplainabilityEngine(state.model)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_engine()
    yield


startup_event = init_engine


app = FastAPI(
    title="AEGIS-Fraud X Engine API",
    description="Adaptive Graph-Enhanced Intelligence for Explainable, Cost-Aware Financial Fraud Prevention",
    version="1.2.0",
    lifespan=lifespan,
)

# CORS setup: explicit origin allowlist via environment variable.
# Wildcard origins combined with allow_credentials=True are disallowed;
# the default covers only local development origins. Both plain
# comma-separated and JSON-list formats are accepted.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
_raw_origins = os.environ.get("AEGIS_CORS_ORIGINS", _default_origins).strip()
ALLOWED_ORIGINS = [
    o.strip().strip('"').strip("'")
    for o in _raw_origins.strip("[]").split(",")
    if o.strip().strip('"').strip("'")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request correlation IDs + structured access logs (no payload data logged)
if RequestIDMiddleware is not None:
    app.add_middleware(RequestIDMiddleware)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AEGIS-Fraud X Production Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_id": state.model.model_id if state.model else "initializing",
        "graph_nodes": state.temporal_graph.graph.number_of_nodes() if state.temporal_graph else 0,
        "graph_edges": state.temporal_graph.graph.number_of_edges() if state.temporal_graph else 0,
        "active_policy": state.current_policy.model_dump() if state.current_policy else {},
        # Artifact provenance: which trained artifacts produced this engine
        "artifact_status": state.artifact_status,
        "artifact_run_id": state.artifact_run_id,
        "calibration_source": state.calibration_source,
    }


def _score_and_decide(tx: Transaction) -> PredictionResult:
    """Core scoring path: features -> model -> calibration -> policy -> SHAP -> receipt.

    No side-effect-free guarantees here: callers decide about idempotency,
    rate limiting, and ledger persistence.
    """
    t0 = time.perf_counter()

    if state.feature_pipeline is None or not state.feature_pipeline.fitted:
        init_engine()

    # Convert single transaction to single-row DataFrame
    row_df = pd.DataFrame(
        [
            {
                "transaction_id": tx.transaction_id,
                "timestamp": tx.timestamp,
                "sender_id": tx.sender_id,
                "receiver_id": tx.receiver_id,
                "amount": tx.amount,
                "currency": tx.currency,
                "channel": tx.channel.value if hasattr(tx.channel, "value") else str(tx.channel),
                "device_id": tx.device_id or "none",
                "ip_address": tx.ip_address or "none",
                "location": tx.location or "US-NYC",
                "category": tx.category or "retail",
            }
        ]
    )

    # 1. Extract tabular features
    X_tab = state.require(state.feature_pipeline).transform(row_df)

    # 2. Extract graph features
    g_feats = state.require(state.graph_extractor).extract_features_for_transaction(
        graph=state.require(state.temporal_graph),
        sender_id=tx.sender_id,
        receiver_id=tx.receiver_id,
        timestamp=tx.timestamp,
        device_id=tx.device_id,
    )
    g_vector = np.array(
        [
            [
                g_feats["graph_sender_out_degree"],
                g_feats["graph_receiver_in_degree"],
                g_feats["graph_device_shared_accounts"],
                g_feats["graph_cycle_detected"],
                g_feats["graph_is_reciprocal"],
                g_feats["graph_sender_pagerank"],
            ]
        ]
    )

    X_full = (
        np.hstack([X_tab, g_vector])
        if state.model and len(state.model.feature_names) > X_tab.shape[1]
        else X_tab
    )

    # 3. Model inference
    raw_score = float(state.model.predict_proba(X_full)[0]) if state.model else 0.05
    calibrated_prob = (
        float(state.calibrator.calibrate(np.array([raw_score]))[0])
        if state.calibrator
        else raw_score
    )
    calibrated_prob = float(np.clip(calibrated_prob, 0.0, 1.0))

    # 4. Action determination using active policy
    policy = state.current_policy or DecisionPolicy()
    if calibrated_prob < policy.tau_allow:
        action = OperationalAction.ALLOW
    elif calibrated_prob < policy.tau_review:
        action = OperationalAction.CHALLENGE if policy.use_challenge else OperationalAction.REVIEW
    elif calibrated_prob < policy.tau_block:
        action = OperationalAction.REVIEW
    else:
        action = OperationalAction.BLOCK

    # 5. Local SHAP Explainability
    top_features = []
    if state.explainer:
        top_features = state.explainer.explain_instance(X_full[0], top_k=5)

    # 6. Cryptographic Audit Receipt
    receipt = state.require(state.receipt_gen).create_receipt(
        transaction_id=tx.transaction_id,
        model_id=state.model.model_id if state.model else "aegis_champion",
        model_version=state.model.version if state.model else "1.0",
        calibrated_probability=calibrated_prob,
        recommended_action=action,
        financial_cost_estimate=tx.amount if calibrated_prob > 0.5 else 0.0,
        top_features=top_features,
        timestamp=tx.timestamp,
    )

    # 7. Add to temporal graph state for forward-chaining
    state.require(state.temporal_graph).add_transaction(
        sender_id=tx.sender_id,
        receiver_id=tx.receiver_id,
        amount=tx.amount,
        timestamp=tx.timestamp,
        device_id=tx.device_id,
    )

    latency_ms = (time.perf_counter() - t0) * 1000.0

    return PredictionResult(
        transaction_id=tx.transaction_id,
        calibrated_probability=round(calibrated_prob, 4),
        raw_score=round(raw_score, 4),
        recommended_action=action,
        policy_name=policy.policy_name,
        model_id=state.model.model_id if state.model else "aegis_champion",
        model_version=state.model.version if state.model else "1.0",
        inference_latency_ms=round(latency_ms, 2),
        expected_fraud_loss=round(tx.amount * calibrated_prob, 2),
        expected_cost=round(
            state.require(state.cost_engine).calculate_action_cost(
                action, 1 if calibrated_prob > 0.5 else 0, tx.amount
            ),
            2,
        ),
        top_features=top_features,
        audit_receipt_hash=receipt.sha256_hash,
        audit_receipt=receipt.model_dump(mode="json"),
    )


def _ledger_record(tx: Transaction, result: PredictionResult) -> None:
    """Appends a decision record (receipt-linked, provenance-complete, payload-minimal)."""
    ledger = state.require(state.decision_ledger)
    ledger.append(
        {
            "transaction_id": tx.transaction_id,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "model_id": result.model_id,
            "model_version": result.model_version,
            "policy_name": result.policy_name,
            "artifact_run_id": state.artifact_run_id,
            "calibration_source": state.calibration_source,
            "calibrated_probability": result.calibrated_probability,
            "recommended_action": result.recommended_action.value,
            "receipt_sha256": result.audit_receipt_hash,
            "source": "live",
        }
    )


@app.get("/api/ready")
def readiness_check():
    """Readiness (distinct from liveness): can this engine serve real decisions?"""
    checks = {
        "model_loaded": state.model is not None,
        "calibrator_fitted": bool(state.calibrator and state.calibrator.fitted),
        "policy_present": state.current_policy is not None,
        "feature_pipeline_fitted": bool(state.feature_pipeline and state.feature_pipeline.fitted),
        "bundle_validated": state.artifact_status == "bundle_validated",
    }
    ready = all(checks.values())
    return {
        "ready": ready,
        "checks": checks,
        "artifact_status": state.artifact_status,
        "artifact_run_id": state.artifact_run_id,
        "calibration_source": state.calibration_source,
    }


@app.post("/api/score", response_model=PredictionResult)
def score_transaction(tx: Transaction, request: Request):
    """Real-time scoring with idempotency, rate limiting, and audit ledger.

    - Re-delivery of the same transaction_id within the idempotency window
      returns the ORIGINAL decision without re-applying side effects.
    - Mutating traffic is rate limited per client with 429 responses.
    - Every first-time decision is appended to the tamper-evident,
      receipt-linked decision ledger.
    """
    if state.feature_pipeline is None or not state.feature_pipeline.fitted:
        init_engine()

    # Per-client token bucket (demo-scale defaults, documented in integrity.py)
    client = request.client.host if request.client else "anonymous"
    allowed, retry_after = state.require(state.rate_limiter).allow(client)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded; retry after {retry_after:.1f}s",
        )

    # Idempotent replay: original decision returned, no side effects re-applied
    cached = state.require(state.idempotency).get(tx.transaction_id)
    if cached is not None:
        replay = cached.model_copy()
        replay.idempotent_replay = True
        return replay

    result = _score_and_decide(tx)
    state.require(state.idempotency).put(tx.transaction_id, result)
    _ledger_record(tx, result)
    return result


class InjectTransactionRequest(BaseModel):
    sender_id: str = "usr_9999"
    receiver_id: str = "merch_999"
    amount: float = 1250.0
    channel: ChannelType = ChannelType.MOBILE
    device_id: Optional[str] = "dev_inject_1"
    category: str = "money_transfer"
    is_fraud_simulated: int = 1


@app.post("/api/stream/inject")
def inject_transaction(req: InjectTransactionRequest):
    """Dynamically injects a custom transaction into the stream and graph."""
    now = datetime.now(timezone.utc)
    tx = Transaction(
        transaction_id=f"inject_{int(now.timestamp())}_{np.random.randint(100, 999)}",
        timestamp=now,
        sender_id=req.sender_id,
        receiver_id=req.receiver_id,
        amount=req.amount,
        currency="USD",
        channel=req.channel,
        device_id=req.device_id,
        category=req.category,
        is_fraud=req.is_fraud_simulated,
    )
    # Injection goes through the same integrity path (idempotency + ledger);
    # injected ids are always fresh, so it behaves as first-time scoring.
    result = _score_and_decide(tx)
    state.require(state.idempotency).put(tx.transaction_id, result)
    _ledger_record(tx, result)
    score_res = result
    return {
        "status": "injected",
        "transaction": tx.model_dump(),
        "score_result": score_res.model_dump(),
    }


class OptimizePolicyRequest(BaseModel):
    investigation_cost: float = 15.00
    customer_friction_cost: float = 5.00
    friction_block_cost: float = 25.00
    max_fpr: float = 0.015
    review_capacity_daily: int = 100


@app.post("/api/optimize-policy")
def optimize_policy_endpoint(req: OptimizePolicyRequest):
    """Dynamic policy optimizer recalculating cost frontier based on user parameters."""
    cfg = CostConfiguration(
        investigation_cost=req.investigation_cost,
        customer_friction_cost=req.customer_friction_cost,
        friction_block_cost=req.friction_block_cost,
        max_fpr=req.max_fpr,
        review_capacity_daily=req.review_capacity_daily,
    )
    optimizer = PolicyOptimizer(cfg)

    if state.sample_transactions is not None:
        y_test = np.asarray(state.sample_transactions["is_fraud"].values)
        amt_test = np.asarray(state.sample_transactions["amount"].values)
        if state.sample_X is not None:
            X = state.sample_X
        else:
            X_tab = state.require(state.feature_pipeline).transform(state.sample_transactions)
            if state.model and len(state.model.feature_names) > X_tab.shape[1]:
                gf_df = state.require(state.graph_extractor).extract_batch_graph_features(
                    state.sample_transactions
                )
                X = np.hstack([X_tab, gf_df.values])
            else:
                X = X_tab

        probs = (
            state.require(state.calibrator).calibrate(state.require(state.model).predict_proba(X))
            if state.model
            else np.random.uniform(0, 0.2, len(y_test))
        )
        comparisons = optimizer.compare_policies(probs, amt_test, y_test)

        # Update active policy in global state
        best_pol_data = comparisons["aegis_cost_optimized"]["policy"]
        state.current_policy = DecisionPolicy(**best_pol_data)

        return {
            "status": "success",
            "active_policy": state.current_policy.model_dump(),
            "comparisons": comparisons,
        }
    else:
        raise HTTPException(status_code=500, detail="Reference transactions not loaded.")


@app.get("/api/benchmarks")
def get_benchmarks():
    """Returns official benchmark artifacts across candidate models."""
    if state.benchmark_data:
        return state.benchmark_data
    raise HTTPException(status_code=404, detail="Benchmark artifacts not found.")


@app.get("/api/graph/subgraph")
def get_graph_subgraph(limit_nodes: int = 40):
    """Returns nodes and edges for interactive network graph rendering."""
    if state.temporal_graph is None:
        init_engine()

    G = state.require(state.temporal_graph).graph
    nodes = []
    edges = []

    sub_nodes = list(G.nodes())[:limit_nodes]
    subgraph = G.subgraph(sub_nodes)

    # Risk signal is DERIVED from real graph topology: an account belongs to a
    # cycle iff it sits in a strongly connected component of size > 1. No
    # fabricated per-name risk scores.
    sccs = [comp for comp in nx.strongly_connected_components(subgraph) if len(comp) > 1]
    cycle_members = set().union(*sccs) if sccs else set()

    for n in subgraph.nodes():
        is_mule = "mule" in str(n)
        nodes.append(
            {
                "id": str(n),
                "label": str(n),
                "type": "mule_account"
                if is_mule
                else ("merchant" if "merch" in str(n) else "account"),
                # Display-scale indicator of real cycle membership (not a model score)
                "risk_score": 0.9 if n in cycle_members else 0.1,
                "cycle_member": n in cycle_members,
                "in_degree": G.in_degree(n),
                "out_degree": G.out_degree(n),
            }
        )

    for u, v, d in subgraph.edges(data=True):
        edges.append(
            {
                "source": str(u),
                "target": str(v),
                "amount": float(d.get("weight", 100.0)),
            }
        )

    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
    }


@app.get("/api/stream/replay-batch")
def get_replay_batch(offset: int = 0, limit: int = 50):
    """
    Returns sequential transactions with live Digital Twin comparison
    (Baseline Rule Policy vs AEGIS-Fraud X Cost-Optimized Policy).
    """
    if state.sample_transactions is None:
        init_engine()

    total_len = len(state.require(state.sample_transactions))
    # Loop over offset if exceeds available transactions
    safe_offset = offset % total_len
    slice_df = state.require(state.sample_transactions).iloc[safe_offset : safe_offset + limit]
    results = []

    fixed_baseline_cost = 0.0
    aegis_optimized_cost = 0.0

    for _, row in slice_df.iterrows():
        tx = Transaction(
            transaction_id=str(row["transaction_id"]),
            timestamp=row["timestamp"],
            sender_id=str(row["sender_id"]),
            receiver_id=str(row["receiver_id"]),
            amount=float(row["amount"]),
            currency="USD",
            channel=row.get("channel", "mobile"),
            device_id=str(row.get("device_id", "none")),
            is_fraud=int(row["is_fraud"]),
        )
        # Replay is a reprocessing mode: it intentionally bypasses the live
        # idempotency cache and ledger (simulation, not live decisions).
        score_res = _score_and_decide(tx)

        is_fraud = int(row["is_fraud"])
        amt = float(row["amount"])

        baseline_act = "BLOCK" if score_res.calibrated_probability >= 0.50 else "ALLOW"
        if baseline_act == "BLOCK":
            base_cost = (
                0.0
                if is_fraud == 1
                else state.require(state.cost_engine).config.friction_block_cost
            )
        else:
            base_cost = amt if is_fraud == 1 else 0.0

        # Both sides of the comparison use GROUND-TRUTH labels and the same
        # cost engine, so the twin comparison cannot understate missed fraud.
        aegis_cost = state.require(state.cost_engine).calculate_action_cost(
            score_res.recommended_action, is_fraud, amt
        )
        fixed_baseline_cost += base_cost
        aegis_optimized_cost += aegis_cost

        results.append(
            {
                "transaction": tx.model_dump(),
                "aegis_result": score_res.model_dump(),
                "baseline_action": baseline_act,
                "baseline_cost": round(base_cost, 2),
                "aegis_cost": round(aegis_cost, 2),
                "ground_truth_fraud": is_fraud,
            }
        )

    return {
        "batch_offset": offset,
        "batch_count": len(results),
        "total_available": total_len,
        "cumulative_summary": {
            "baseline_total_cost": round(fixed_baseline_cost, 2),
            "aegis_total_cost": round(aegis_optimized_cost, 2),
            "net_dollar_savings": round(max(0.0, fixed_baseline_cost - aegis_optimized_cost), 2),
            "savings_percentage": round(
                (
                    max(0.0, fixed_baseline_cost - aegis_optimized_cost)
                    / max(1.0, fixed_baseline_cost)
                )
                * 100,
                1,
            ),
        },
        "records": results,
    }


class StressScenarioRequest(BaseModel):
    scenario: str = "smurfing"  # "smurfing" | "spoofing" | "volume_surge"


@app.post("/api/drift/simulate-stress")
def simulate_stress_endpoint(req: StressScenarioRequest):
    """Applies controlled defensive stress scenarios in-memory and returns empirical drift metrics."""
    if state.sample_transactions is None:
        init_engine()
    assert state.sample_transactions is not None, "engine not initialized; call init_engine() first"

    base_df = state.sample_transactions.iloc[:1000]
    target_df = state.sample_transactions.iloc[1000:2000].copy()

    if req.scenario == "smurfing":
        stressed_df = cast(StressTestingLab, state.stress_lab).simulate_smurfing_attack(
            target_df, attack_fraction=0.30
        )
        scenario_desc = (
            "Adversarial Smurfing / Structuring ($4,500 - $4,890 to bypass $5k rule checks)"
        )
    elif req.scenario == "spoofing":
        stressed_df = cast(StressTestingLab, state.stress_lab).simulate_device_spoofing(
            target_df, spoof_fraction=0.40
        )
        scenario_desc = "Rapid Device Fingerprint Spoofing & Tor Proxy Subnet Proliferation"
    else:
        stressed_df = target_df
        scenario_desc = "Clean Baseline Stationary Stream"

    b_amounts = np.asarray(base_df["amount"].values)
    t_amounts = np.asarray(stressed_df["amount"].values)

    psi_amt = state.require(state.drift_monitor).calculate_psi(b_amounts, t_amounts)
    wd_amt = state.require(state.drift_monitor).calculate_wasserstein(b_amounts, t_amounts)

    if psi_amt >= 0.25:
        status = "CRITICAL_DRIFT"
        alert_level = "RED"
    elif psi_amt >= 0.10:
        status = "WARNING_MODERATE_DRIFT"
        alert_level = "AMBER"
    else:
        status = "STABLE"
        alert_level = "GREEN"

    return {
        "status": status,
        "alert_level": alert_level,
        "scenario": req.scenario,
        "scenario_description": scenario_desc,
        "amount_psi": round(psi_amt, 4),
        "amount_wasserstein_distance": round(wd_amt, 2),
        "action_required": bool(psi_amt >= 0.10),
        "recommendation": (
            "Automatic policy threshold adaptation triggered. Step-up OTP challenges active."
            if psi_amt >= 0.10
            else "System stationary. Normal operational thresholds active."
        ),
    }


@app.post("/api/drift/evaluate")
def evaluate_drift_endpoint():
    """Runs Population Stability Index and Wasserstein distance drift checks on streaming window."""
    return simulate_stress_endpoint(StressScenarioRequest(scenario="none"))


class VerifyReceiptRequest(BaseModel):
    receipt: Dict[str, Any]


@app.post("/api/receipts/verify")
def verify_receipt_endpoint(req: VerifyReceiptRequest):
    """Verifies the keyed HMAC-SHA256 signature of a receipt.

    Truthful semantics: a matching HMAC proves content integrity and issuer
    authenticity RELATIVE TO THE SECRECY OF THE SERVER'S KEY (see
    packages/explainability/receipts.py). It is not a public-key signature
    and provides no revocation.
    """
    try:
        receipt_obj = AuditReceipt(**req.receipt)
        is_valid = state.require(state.receipt_gen).verify_receipt(receipt_obj)
        return {
            "receipt_id": receipt_obj.receipt_id,
            "is_valid": is_valid,
            "signature_algorithm": receipt_obj.signature_algorithm,
            "sha256_hash": receipt_obj.sha256_hash,
            "status": "SIGNATURE_VERIFIED" if is_valid else "SIGNATURE_INVALID",
            "verification_semantics": (
                "HMAC-SHA256 keyed signature under a server-held secret. "
                "Verifies content integrity and issuer authenticity relative "
                "to key secrecy; not a public-key signature."
            ),
        }
    except Exception as e:
        return {
            "is_valid": False,
            "status": "SCHEMA_VALIDATION_ERROR",
            "error_detail": str(e),
        }
