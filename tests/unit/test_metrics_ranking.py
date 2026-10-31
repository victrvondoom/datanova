"""Unit tests for Precision@K / Recall@K ranking metrics.

Catalog: eval_precision_at_k, eval_recall_at_k — previously mislabeled
'missing' in the catalog; the implementation has existed since Milestone 1
and flows into every benchmark artifact. These tests pin the math against
manual computation and edge cases."""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.evaluation.metrics import FraudEvaluationMetrics


def test_ranking_metrics_match_manual_computation():
    # 1000 rows so K=100 < n (conventional Precision@100 over the true top 100)
    rng = np.random.default_rng(11)
    n = 1000
    y = np.zeros(n, dtype=int)
    probs = rng.uniform(0, 1, n)
    # Place 3 frauds at known ranks: ranks 1, 10, 150 (by descending score)
    order = np.argsort(probs)[::-1]
    y[order[0]] = 1
    y[order[9]] = 1
    y[order[149]] = 1
    amt = np.full(n, 100.0)

    m = FraudEvaluationMetrics.evaluate(y, probs, amt)

    # Top-100 contains the frauds at ranks 1 and 10 -> precision 2/100
    # The fraud at rank 150 is outside -> recall 2/3
    assert m["precision_at_k100"] == round(2 / 100, 5)
    assert m["recall_at_k100"] == round(2 / 3, 5)


def test_ranking_metrics_small_sample_is_prevalence():
    """K > n: the top-K is the whole sample, so precision@K equals prevalence."""
    y = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0])
    probs = np.linspace(0.05, 0.95, 10)
    m = FraudEvaluationMetrics.evaluate(y, probs, np.full(10, 100.0))
    assert m["precision_at_k100"] == round(3 / 10, 5)
    assert m["recall_at_k100"] == 1.0


def test_ranking_metrics_edge_all_legit():
    y = np.zeros(20, dtype=int)
    probs = np.linspace(0, 1, 20)
    m = FraudEvaluationMetrics.evaluate(y, probs, np.full(20, 50.0))
    assert m["precision_at_k100"] == 0.0
    assert m["recall_at_k100"] == 0.0  # no fraud -> recall defined 0 via max(1, 0)


def test_ranking_metrics_all_fraud():
    y = np.ones(10, dtype=int)
    probs = np.linspace(0.1, 1.0, 10)
    m = FraudEvaluationMetrics.evaluate(y, probs, np.full(10, 50.0))
    assert m["precision_at_k100"] == 1.0
    assert m["recall_at_k100"] == 1.0
