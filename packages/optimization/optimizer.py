"""
Constrained Operational Policy Optimizer.
Solves for optimal multi-action thresholds (tau_allow, tau_review, tau_block) that
minimize total operational cost subject to hard investigator capacity and FPR constraints.
"""

from typing import Dict, Optional, Tuple

import numpy as np

from packages.data.schemas import CostConfiguration, DecisionPolicy
from packages.optimization.cost_engine import CostEngine
from packages.optimization.exact_optimizer import ExactPolicyOptimizer, InfeasiblePolicyError


class PolicyOptimizer:
    """
    Authoritative policy optimizer: delegates to ExactPolicyOptimizer, which
    enumerates the complete space of realizable threshold policies
    (distinct-value cuts) and returns the provably optimal feasible policy.

    The legacy coarse percentile grid is retained as
    `optimize_policy_coarse_grid` for optimization-regret diagnostics ONLY;
    it is not used for deployed policy selection.
    """

    def __init__(self, cost_config: Optional[CostConfiguration] = None):
        self.cost_config = cost_config or CostConfiguration()
        self.cost_engine = CostEngine(self.cost_config)
        self.exact = ExactPolicyOptimizer(self.cost_config)

    def optimize_policy(
        self,
        calibrated_probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
        grid_resolution: int = 20,
    ) -> Tuple[DecisionPolicy, Dict[str, float]]:
        """
        Exact constrained optimization over all realizable threshold policies.
        Raises InfeasiblePolicyError when no realizable policy satisfies the
        hard FPR / review-capacity constraints (never returns an infeasible
        policy as success).
        """
        return self.exact.solve(calibrated_probs, amounts, labels)

    def optimize_policy_coarse_grid(
        self,
        calibrated_probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
    ) -> Tuple[DecisionPolicy, Dict[str, float]]:
        """
        LEGACY coarse percentile-grid search (diagnostic use only: measuring
        optimization regret against the exact solver). Its fallback performs NO
        constraint check and may return policies that violate constraints.
        """
        n = len(calibrated_probs)
        # Normalized daily capacity limit as maximum review rate
        # e.g., 100 reviews per 10k transactions -> 1%
        max_review_rate = float(self.cost_config.review_capacity_daily / max(100.0, float(n)))
        max_fpr = self.cost_config.max_fpr

        best_cost = float("inf")
        best_policy = DecisionPolicy(
            policy_name="Cost-Aware-Optimized",
            tau_allow=0.15,
            tau_review=0.45,
            tau_block=0.85,
        )
        best_metrics: Dict[str, float] = {}

        # Enforce capacity strictly: Review rate cannot exceed max_review_rate
        # We search thresholds guided by empirical probability percentiles.
        # Isotonic calibration often maps a large mass of low-risk scores to
        # exactly 0.0, so low percentiles collapse to 0 and no candidate could
        # satisfy the FPR constraint. We therefore include high percentiles and
        # the smallest strictly-positive probability (which allows exactly the
        # zero-mass and challenges only scored traffic).
        allow_percentiles = [50, 70, 80, 85, 90, 92, 95, 97, 98, 99, 99.5]
        allow_candidates = list(np.percentile(calibrated_probs, allow_percentiles))
        positive_probs = calibrated_probs[calibrated_probs > 1e-12]
        if positive_probs.size > 0:
            allow_candidates.append(float(np.min(positive_probs)))
        allow_candidates = sorted(set(allow_candidates))

        # To guarantee review_rate <= max_review_rate:
        # We can set tau_review such that only at most max_review_rate of transactions fall in [tau_review, tau_block]
        cap_pct = max(0.001, min(0.50, max_review_rate))

        for t_allow in allow_candidates:
            # We test block rates between 0.1% and 5%
            for blk_pct in [0.002, 0.005, 0.01, 0.02, 0.05]:
                t_blk = float(np.percentile(calibrated_probs, max(0.0, (1.0 - blk_pct) * 100)))
                # Set t_rev such that at most cap_pct transactions fall in [t_rev, t_blk]
                rev_pct = cap_pct * 0.90  # 90% of cap to guarantee buffer
                t_rev = float(
                    np.percentile(calibrated_probs, max(0.0, (1.0 - blk_pct - rev_pct) * 100))
                )

                if t_rev <= t_allow:
                    t_rev = min(1.0, t_allow + 0.01)
                if t_blk <= t_rev:
                    t_blk = min(1.0, t_rev + 0.01)
                # Degenerate candidate (thresholds collapsed at the top of the
                # probability range): no valid 4-tier policy can be formed.
                if t_allow >= 1.0 or t_rev <= t_allow or t_blk <= t_rev:
                    continue

                candidate_policy = DecisionPolicy(
                    policy_name="Candidate",
                    tau_allow=float(t_allow),
                    tau_review=float(t_rev),
                    tau_block=float(t_blk),
                    use_challenge=True,
                )

                res = self.cost_engine.evaluate_policy_batch(
                    calibrated_probs=calibrated_probs,
                    amounts=amounts,
                    labels=labels,
                    policy=candidate_policy,
                )

                # Hard constraint enforcement
                if res["false_positive_rate"] > max_fpr:
                    continue
                if res["review_rate"] > max_review_rate:
                    continue

                if res["total_cost"] < best_cost:
                    best_cost = res["total_cost"]
                    best_policy = DecisionPolicy(
                        policy_name="Cost-Aware-Optimized",
                        tau_allow=round(float(t_allow), 4),
                        tau_review=round(float(t_rev), 4),
                        tau_block=round(float(t_blk), 4),
                        use_challenge=True,
                    )
                    best_metrics = res

        # Fallback: safest defensible policy when no grid candidate satisfied
        # the constraints. It is built directly from the constraint definitions
        # (allow all but the top max_fpr fraction; review within capacity) and
        # its realized metrics are reported honestly so violations are visible.
        if best_cost == float("inf"):
            # tau_allow: allow every transaction below the (1 - max_fpr) quantile
            t_allow = float(np.percentile(calibrated_probs, (1.0 - max_fpr) * 100))
            # If a point mass at 0 absorbs the quantile, allow exactly the zero mass
            if t_allow <= 1e-12:
                positive = calibrated_probs[calibrated_probs > 1e-12]
                t_allow = float(np.min(positive)) if positive.size > 0 else 1.0
            # Review window: at most 90% of the review capacity budget
            t_rev = float(
                np.percentile(
                    calibrated_probs, max(0.0, (1.0 - max_review_rate * 0.9) * 100)
                )
            )
            t_blk = float(np.percentile(calibrated_probs, 99.0))
            if t_rev <= t_allow:
                t_rev = min(1.0, t_allow + 0.01)
            if t_blk <= t_rev:
                t_blk = min(1.0, t_rev + 0.01)

            fallback_policy = DecisionPolicy(
                policy_name="Constrained-Safe",
                tau_allow=round(float(t_allow), 4),
                tau_review=round(float(t_rev), 4),
                tau_block=round(float(t_blk), 4),
                use_challenge=True,
            )
            best_metrics = self.cost_engine.evaluate_policy_batch(
                calibrated_probs=calibrated_probs,
                amounts=amounts,
                labels=labels,
                policy=fallback_policy,
            )
            best_policy = fallback_policy

        return best_policy, best_metrics

    def compare_policies(
        self,
        calibrated_probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
    ) -> Dict[str, Dict]:
        """
        Compares 4 standard operational regimes:
        1. Conventional Fixed Threshold (p >= 0.5 -> Block)
        2. Top-K Manual Review Only
        3. Challenge-Heavy Policy (Aggressive OTP)
        4. AEGIS Cost-Aware Optimized Policy
        """
        # Policy 1: Fixed 0.5 threshold
        fixed_policy = DecisionPolicy(
            policy_name="Fixed-Threshold (p>=0.5)",
            tau_allow=0.50,
            tau_review=0.50,
            tau_block=0.50,
            use_challenge=False,
        )
        res_fixed = self.cost_engine.evaluate_policy_batch(
            calibrated_probs, amounts, labels, fixed_policy
        )

        # Policy 2: Rule-of-thumb Conservative (High Allow, High Block)
        conservative_policy = DecisionPolicy(
            policy_name="Conservative Heuristic",
            tau_allow=0.30,
            tau_review=0.70,
            tau_block=0.95,
            use_challenge=False,
        )
        res_cons = self.cost_engine.evaluate_policy_batch(
            calibrated_probs, amounts, labels, conservative_policy
        )

        # Policy 3: AEGIS Optimized
        opt_policy, res_opt = self.optimize_policy(calibrated_probs, amounts, labels)

        return {
            "fixed_threshold_baseline": {
                "policy": fixed_policy.model_dump(),
                "metrics": res_fixed,
            },
            "conservative_baseline": {
                "policy": conservative_policy.model_dump(),
                "metrics": res_cons,
            },
            "aegis_cost_optimized": {
                "policy": opt_policy.model_dump(),
                "metrics": res_opt,
            },
        }
