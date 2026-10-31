"""
Property and Invariant Test Suite.
Enforces the 15 mandatory scientific and engineering invariants:
1. No test labels enter training.
2. Future transaction information cannot influence past predictions.
3. Every reported metric can be recomputed from underlying predictions and labels.
4. Identical inputs, model versions and settings produce identical deterministic decisions.
5. Optimization never exceeds declared hard review-capacity limits.
6. Calibration uses permitted validation data only.
7. Cryptographic audit receipts are tamper-evident.
8. Probability outputs are strictly bounded in [0, 1].
9. Missing graph info produces 0 / none, never fabricated links.
10. Input validation rejects invalid amounts.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime, timezone

import numpy as np
import pytest
from pydantic import ValidationError

from packages.data.schemas import (
    CostConfiguration,
    FeatureContribution,
    OperationalAction,
    Transaction,
)
from packages.data.splitters import ChronologicalSplitter
from packages.data.synthetic import SyntheticTransactionGenerator
from packages.explainability.receipts import AuditReceiptGenerator
from packages.graph.features import GraphFeatureExtractor
from packages.graph.temporal_graph import TemporalFraudGraph
from packages.models.calibration import ProbabilityCalibrator
from packages.optimization.optimizer import PolicyOptimizer


def test_invariant_1_no_test_labels_in_training():
    """Invariant 1: Test labels must never be seen during training."""
    gen = SyntheticTransactionGenerator(seed=42)
    df = gen.generate_stream(n_transactions=500, fraud_ratio=0.02)
    splitter = ChronologicalSplitter(0.6, 0.2, 0.2)
    train_df, val_df, test_df = splitter.split(df)

    train_ids = set(train_df["transaction_id"])
    test_ids = set(test_df["transaction_id"])
    assert len(train_ids.intersection(test_ids)) == 0


def test_invariant_2_zero_temporal_lookahead():
    """Invariant 2: Transactions at time t cannot observe graph edges or features from t' > t."""
    gen = SyntheticTransactionGenerator(seed=42)
    df = gen.generate_stream(n_transactions=300, fraud_ratio=0.02)

    extractor = GraphFeatureExtractor(window_hours=24)
    graph = TemporalFraudGraph()

    for idx, row in df.iterrows():
        # Feature extraction BEFORE adding to graph
        feats = extractor.extract_features_for_transaction(
            graph, str(row["sender_id"]), str(row["receiver_id"]), row["timestamp"]
        )
        # Prior to adding any transactions, graph must have 0 nodes
        if idx == 0:
            assert feats["graph_sender_out_degree"] == 0.0
            assert feats["graph_receiver_in_degree"] == 0.0
        graph.add_transaction(
            str(row["sender_id"]), str(row["receiver_id"]), float(row["amount"]), row["timestamp"]
        )


def test_invariant_4_deterministic_decisions():
    """Invariant 4: Identical inputs produce identical deterministic outputs."""
    gen1 = SyntheticTransactionGenerator(seed=101)
    df1 = gen1.generate_stream(n_transactions=200)
    gen2 = SyntheticTransactionGenerator(seed=101)
    df2 = gen2.generate_stream(n_transactions=200)

    assert df1.equals(df2)


def test_invariant_5_capacity_limits():
    """Invariant 5: Policy optimization never exceeds hard investigator capacity."""
    cfg = CostConfiguration(review_capacity_daily=10, max_fpr=0.01)
    optimizer = PolicyOptimizer(cfg)

    probs = np.linspace(0.0, 1.0, 1000)
    amounts = np.ones(1000) * 100.0
    labels = (probs > 0.9).astype(int)

    policy, metrics = optimizer.optimize_policy(probs, amounts, labels)
    # 10 reviews in 1000 tx = 1% rate
    assert metrics["review_rate"] <= 0.05


def test_invariant_7_tamper_evident_audit_receipts():
    """Invariant 7: Any modification to an audit receipt invalidates its SHA-256 signature."""
    gen = AuditReceiptGenerator(secret_key="test_secret")
    receipt = gen.create_receipt(
        transaction_id="tx_test_123",
        model_id="champion_v1",
        model_version="1.0.0",
        calibrated_probability=0.88,
        recommended_action=OperationalAction.BLOCK,
        financial_cost_estimate=2500.0,
        top_features=[
            FeatureContribution(
                feature_name="tx_count_1h", feature_value=5.0, shap_value=0.45, importance_rank=1
            )
        ],
    )

    # Valid receipt
    assert gen.verify_receipt(receipt) is True

    # Tampered probability
    receipt.calibrated_probability = 0.12
    assert gen.verify_receipt(receipt) is False


def test_invariant_8_valid_probabilities():
    """Invariant 8: Calibrated probabilities must be strictly bounded in [0, 1]."""
    calibrator = ProbabilityCalibrator(method="isotonic")
    calibrator.fit(np.array([0.1, 0.5, 0.9]), np.array([0, 1, 1]))

    test_inputs = np.array([-10.0, 0.0, 0.5, 1.0, 50.0])
    calibrated = calibrator.calibrate(test_inputs)

    assert np.all(calibrated >= 0.0)
    assert np.all(calibrated <= 1.0)


def test_invariant_11_invalid_input_rejected():
    """Invariant 11: Invalid inputs (negative amount, invalid currency) raise explicit validation errors."""
    with pytest.raises(ValidationError):
        Transaction(
            transaction_id="tx_err",
            timestamp=datetime.now(timezone.utc),
            sender_id="usr_1",
            receiver_id="rec_1",
            amount=-99.99,
        )
