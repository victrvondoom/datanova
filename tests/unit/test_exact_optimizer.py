"""Brute-force correctness tests for the ExactPolicyOptimizer.

The exact solver claims optimality over ALL realizable threshold policies. To
falsify that claim, these tests compare it against an independent naive O(m^3)
enumeration over every distinct-value cut triple on small fixtures, plus
edge cases (ties, zero-inflation, all-ones, single record, capacity limits,
deterministic tie-breaking).
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.data.schemas import CostConfiguration, DecisionPolicy
from packages.optimization.cost_engine import CostEngine
from packages.optimization.exact_optimizer import (
    ExactPolicyOptimizer,
    InfeasiblePolicyError,
)
from packages.optimization.optimizer import PolicyOptimizer


def naive_optimal_cost(probs, amounts, labels, cfg):
    """Independent brute-force optimum over all realizable cut triples."""
    probs = np.asarray(probs, float)
    amounts = np.asarray(amounts, float)
    labels = np.asarray(labels, int)
    n = len(probs)
    engine = CostEngine(cfg)

    unique_vals = np.unique(probs)
    # realizable boundary "above all values" only when no prob equals 1.0
    boundaries = list(unique_vals) + ([1.0] if unique_vals[-1] < 1.0 else [])

    max_review_rate = cfg.review_capacity_daily / max(100.0, float(n))
    cap_cnt = int(np.floor(max_review_rate * n))

    best = np.inf
    for tau_a in boundaries:
        for tau_r in boundaries:
            if tau_r < tau_a:
                continue
            for tau_b in boundaries:
                if tau_b < tau_r:
                    continue
                policy = DecisionPolicy(
                    policy_name="brute",
                    tau_allow=float(tau_a),
                    tau_review=float(tau_r),
                    tau_block=float(tau_b),
                    use_challenge=True,
                )
                met = engine.evaluate_policy_batch(probs, amounts, labels, policy)
                if met["false_positive_rate"] > cfg.max_fpr + 1e-9:
                    continue
                if met["action_counts"]["REVIEW"] > cap_cnt:
                    continue
                best = min(best, met["total_cost"])
    return best


def _rand_case(seed, n=40, tie_digits=1):
    rng = np.random.default_rng(seed)
    probs = np.round(rng.uniform(0.0, 1.0, n), tie_digits)  # force ties
    labels = (rng.uniform(0.0, 1.0, n) < probs).astype(int)
    amounts = np.round(rng.uniform(10.0, 900.0, n), 2)
    return probs, amounts, labels


@pytest.mark.parametrize("seed", [1, 2, 3, 4, 5, 6, 7, 8])
def test_exact_matches_brute_force(seed):
    probs, amounts, labels = _rand_case(seed)
    cfg = CostConfiguration(max_fpr=0.10, review_capacity_daily=25)
    opt = ExactPolicyOptimizer(cfg)
    policy, metrics = opt.solve(probs, amounts, labels)

    brute = naive_optimal_cost(probs, amounts, labels, cfg)
    assert brute != np.inf, "brute force found no feasible policy; fixture is broken"
    # The exact solver must match the independent brute-force optimum to the cent
    assert metrics["total_cost"] <= brute + 0.01
    assert metrics["optimization_status"] == "OPTIMAL"
    # Constraints hold on the fitting data
    assert metrics["false_positive_rate"] <= cfg.max_fpr + 1e-4
    assert metrics["action_counts"]["REVIEW"] <= int(
        np.floor(cfg.review_capacity_daily / max(100.0, len(probs)) * len(probs))
    )
    assert policy.tau_allow <= policy.tau_review <= policy.tau_block


def test_exact_solver_never_worse_than_brute_force_on_feasible_space():
    # stricter constraints; the brute force may find the same or worse-only space
    for seed in range(20, 30):
        probs, amounts, labels = _rand_case(seed, n=30)
        cfg = CostConfiguration(max_fpr=0.05, review_capacity_daily=10)
        opt = ExactPolicyOptimizer(cfg)
        try:
            _, metrics = opt.solve(probs, amounts, labels)
        except InfeasiblePolicyError:
            brute = naive_optimal_cost(probs, amounts, labels, cfg)
            assert brute == np.inf, (
                "Exact solver declared infeasible but brute force found a "
                f"feasible policy (seed={seed})"
            )
            continue
        brute = naive_optimal_cost(probs, amounts, labels, cfg)
        if brute != np.inf:
            assert metrics["total_cost"] <= brute + 0.01


def test_zero_inflated_probs_feasible():
    """AFX-06 regression: isotonic zero-mass must be allowed, not challenged."""
    rng = np.random.default_rng(3)
    n = 2000
    probs = np.zeros(n)
    nonzero_idx = rng.choice(n, size=40, replace=False)
    probs[nonzero_idx] = rng.uniform(0.05, 1.0, 40)
    labels = np.zeros(n, dtype=int)
    labels[nonzero_idx[:20]] = 1
    amounts = rng.uniform(20.0, 900.0, n)

    cfg = CostConfiguration(max_fpr=0.015, review_capacity_daily=100)
    opt = ExactPolicyOptimizer(cfg)
    policy, metrics = opt.solve(probs, amounts, labels)

    assert metrics["false_positive_rate"] <= 0.015
    assert policy.tau_allow > 0.0  # the zero mass is allowed
    # provably optimal: allow-all-zero + challenge/review/block on scored traffic
    assert metrics["optimization_status"] == "OPTIMAL"


def test_all_probs_equal_one_is_infeasible_under_strict_fpr():
    probs = np.ones(50)
    labels = np.zeros(50, dtype=int)  # all legit -> any action is a false positive
    amounts = np.full(50, 100.0)
    cfg = CostConfiguration(max_fpr=0.015, review_capacity_daily=100)
    opt = ExactPolicyOptimizer(cfg)
    with pytest.raises(InfeasiblePolicyError):
        opt.solve(probs, amounts, labels)


def test_all_zero_probs_allow_all():
    probs = np.zeros(50)
    labels = np.zeros(50, dtype=int)
    amounts = np.full(50, 100.0)
    cfg = CostConfiguration(max_fpr=0.015, review_capacity_daily=100)
    opt = ExactPolicyOptimizer(cfg)
    policy, metrics = opt.solve(probs, amounts, labels)
    assert metrics["action_counts"]["ALLOW"] == 50
    assert metrics["false_positive_rate"] == 0.0


def test_single_transaction():
    cfg = CostConfiguration()
    opt = ExactPolicyOptimizer(cfg)
    # single fraud txn with high prob -> block is optimal (cost 0)
    policy, metrics = opt.solve(np.array([0.9]), np.array([500.0]), np.array([1]))
    assert metrics["action_counts"]["BLOCK"] == 1
    # single legit txn -> allow is optimal (cost 0)
    policy, metrics = opt.solve(np.array([0.9]), np.array([500.0]), np.array([0]))
    assert metrics["action_counts"]["ALLOW"] == 1 or (
        metrics["false_positive_rate"] <= cfg.max_fpr + 1e-4
    )


def test_review_capacity_is_respected():
    rng = np.random.default_rng(11)
    n = 500
    probs = rng.uniform(0.0, 1.0, n)
    labels = (probs > 0.5).astype(int)
    amounts = rng.uniform(10.0, 500.0, n)
    cfg = CostConfiguration(max_fpr=1.0, review_capacity_daily=30)
    opt = ExactPolicyOptimizer(cfg)
    _, metrics = opt.solve(probs, amounts, labels)
    max_rate = cfg.review_capacity_daily / max(100.0, n)
    assert metrics["action_counts"]["REVIEW"] <= int(np.floor(max_rate * n))


def test_deterministic_tie_breaking():
    """Repeated solves on identical input must produce identical policies."""
    probs, amounts, labels = _rand_case(42, n=60)
    cfg = CostConfiguration(max_fpr=0.10, review_capacity_daily=50)
    opt = ExactPolicyOptimizer(cfg)
    p1, m1 = opt.solve(probs, amounts, labels)
    p2, m2 = opt.solve(probs, amounts, labels)
    assert p1.model_dump() == p2.model_dump()
    assert m1["total_cost"] == m2["total_cost"]


def test_policy_optimizer_delegates_to_exact():
    """PolicyOptimizer.optimize_policy must use the exact solver."""
    probs, amounts, labels = _rand_case(7, n=50)
    po = PolicyOptimizer(CostConfiguration(max_fpr=0.10, review_capacity_daily=25))
    policy, metrics = po.optimize_policy(probs, amounts, labels)
    assert metrics["solver"] == "exact-distinct-value-sweep"
    brute = naive_optimal_cost(probs, amounts, labels, po.cost_config)
    assert metrics["total_cost"] <= brute + 0.01
