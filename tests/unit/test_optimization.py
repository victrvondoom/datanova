"""Unit tests for cost engine and policy optimizer."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np

from packages.data.schemas import CostConfiguration, OperationalAction
from packages.optimization.cost_engine import CostEngine
from packages.optimization.optimizer import PolicyOptimizer


def test_cost_calculation():
    engine = CostEngine(CostConfiguration(investigation_cost=15.0, customer_friction_cost=5.0))

    # Allow fraud = 100% loss
    cost_allow_fraud = engine.calculate_action_cost(OperationalAction.ALLOW, is_fraud=1, amount=500.0)
    assert cost_allow_fraud == 500.0

    # Allow legit = $0
    cost_allow_legit = engine.calculate_action_cost(OperationalAction.ALLOW, is_fraud=0, amount=500.0)
    assert cost_allow_legit == 0.0

    # Block legit = $25 friction
    cost_block_legit = engine.calculate_action_cost(OperationalAction.BLOCK, is_fraud=0, amount=500.0)
    assert cost_block_legit == 25.0


def test_policy_optimizer_capacity_constraint():
    cfg = CostConfiguration(review_capacity_daily=20, max_fpr=0.02)
    optimizer = PolicyOptimizer(cfg)

    probs = np.random.uniform(0.0, 1.0, 500)
    amounts = np.random.uniform(20.0, 1000.0, 500)
    labels = (probs > 0.8).astype(int)

    policy, metrics = optimizer.optimize_policy(probs, amounts, labels)

    assert policy.tau_allow <= policy.tau_review <= policy.tau_block
    # Capacity constraint check: review rate must be bounded
    assert metrics["review_rate"] <= 0.25
