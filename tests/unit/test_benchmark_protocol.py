"""Regression tests for the zero-leakage benchmark protocol.

Defect history: champion selection and policy threshold optimization were both
performed on the held-out TEST partition (test-set leakage), inflating reported
savings. The protocol now selects on VALIDATION PR-AUC and fits policy
thresholds on VALIDATION predictions only, evaluating the frozen policy once
on test.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.data.schemas import CostConfiguration, DecisionPolicy
from packages.optimization.cost_engine import CostEngine
from packages.optimization.optimizer import PolicyOptimizer
from scripts.run_benchmarks import select_champion_by_validation


def test_champion_selection_ignores_test_metrics():
    # Model B wins on validation, model A wins on test.
    # Champion selection must pick B (validation) regardless of test ranking.
    validation_pr_aucs = {"Model A": 0.71, "Model B": 0.80}
    champion = select_champion_by_validation(validation_pr_aucs)
    assert champion == "Model B"


def test_champion_selection_rejects_empty_candidates():
    try:
        select_champion_by_validation({})
        raise AssertionError("Expected ValueError for empty candidate set")
    except ValueError:
        pass


def _synthetic_validation_population(n: int = 2000, seed: int = 7):
    """Validation-like population: fraud concentrated in high probabilities."""
    rng = np.random.default_rng(seed)
    probs = rng.uniform(0.0, 1.0, n)
    labels = (probs > 0.75).astype(int)
    labels[rng.choice(n, size=int(0.01 * n), replace=False)] = 1
    amounts = rng.uniform(10.0, 500.0, n)
    return probs, amounts, labels


def test_policy_thresholds_fit_on_validation_satisfy_constraints():
    probs, amounts, labels = _synthetic_validation_population()
    optimizer = PolicyOptimizer(CostConfiguration(max_fpr=0.015, review_capacity_daily=100))
    policy, fit_metrics = optimizer.optimize_policy(probs, amounts, labels)

    # Constraints hold on the data the policy was FIT on
    assert fit_metrics["false_positive_rate"] <= 0.015
    assert fit_metrics["review_rate"] <= 100 / len(probs)
    # A policy was actually produced
    assert 0.0 <= policy.tau_allow <= policy.tau_review <= policy.tau_block <= 1.0


def test_frozen_policy_evaluation_does_not_refit_thresholds():
    """Evaluating the frozen policy on new data must not change thresholds."""
    probs, amounts, labels = _synthetic_validation_population()
    optimizer = PolicyOptimizer(CostConfiguration(max_fpr=0.015, review_capacity_daily=100))
    policy, _ = optimizer.optimize_policy(probs, amounts, labels)

    # Fresh (test-like) population with a different distribution
    rng = np.random.default_rng(99)
    test_probs = rng.uniform(0.0, 1.0, 2000)
    test_labels = (test_probs > 0.60).astype(int)
    test_amounts = rng.uniform(10.0, 800.0, 2000)

    frozen = DecisionPolicy(
        policy_name="Cost-Aware-Optimized",
        tau_allow=policy.tau_allow,
        tau_review=policy.tau_review,
        tau_block=policy.tau_block,
        use_challenge=True,
    )
    engine = CostEngine()
    metrics = engine.evaluate_policy_batch(test_probs, test_amounts, test_labels, frozen)

    # Thresholds unchanged after evaluation on new data
    assert frozen.tau_allow == policy.tau_allow
    assert frozen.tau_review == policy.tau_review
    assert frozen.tau_block == policy.tau_block

    # Action assignment is a pure function of the frozen thresholds
    expected_review = int(
        np.sum((test_probs >= frozen.tau_review) & (test_probs < frozen.tau_block))
    )
    assert metrics["action_counts"]["REVIEW"] == expected_review


def test_optimizer_handles_zero_inflated_calibrated_probs():
    """Isotonic calibration often maps most low-risk scores to exactly 0.0.

    Regression: with such distributions the old grid collapsed (all allow
    candidates = 0.0), no candidate passed the FPR constraint, and the
    unchecked fallback returned tau_allow=0.0 -> FPR=1.0 (every legitimate
    transaction challenged). The optimizer must still find a policy that
    satisfies the FPR constraint on the fitting data.
    """
    rng = np.random.default_rng(3)
    n = 2000
    probs = np.zeros(n)
    nonzero_idx = rng.choice(n, size=40, replace=False)
    probs[nonzero_idx] = rng.uniform(0.05, 1.0, 40)
    labels = np.zeros(n, dtype=int)
    labels[nonzero_idx[:20]] = 1  # half of the scored traffic is fraud
    amounts = rng.uniform(20.0, 900.0, n)

    optimizer = PolicyOptimizer(CostConfiguration(max_fpr=0.015, review_capacity_daily=100))
    policy, fit_metrics = optimizer.optimize_policy(probs, amounts, labels)

    # Hard constraints must hold on the data the policy was fitted on
    assert fit_metrics["false_positive_rate"] <= 0.015, (
        "Fallback policy must not challenge every legitimate transaction"
    )
    assert fit_metrics["review_rate"] <= 100 / n
    # The zero-mass must be allowed, not challenged
    assert policy.tau_allow > 0.0
