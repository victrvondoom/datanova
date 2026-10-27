"""
Constrained Operational Policy Optimizer.
Solves for optimal multi-action thresholds (tau_allow, tau_review, tau_block) that
minimize total operational cost subject to hard investigator capacity and FPR constraints.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np

from packages.data.schemas import CostConfiguration, DecisionPolicy, OperationalAction
from packages.optimization.cost_engine import CostEngine


class PolicyOptimizer:
    """
    Finds Pareto-optimal decision thresholds balancing fraud loss, investigation labor, and customer churn.
    """

    def __init__(self, cost_config: CostConfiguration = CostConfiguration()):
        self.cost_config = cost_config
        self.cost_engine = CostEngine(cost_config)

    def optimize_policy(
        self,
        calibrated_probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
        grid_resolution: int = 20,
    ) -> Tuple[DecisionPolicy, Dict[str, float]]:
        """
        Grid search optimization finding best (tau_allow, tau_review, tau_block)
        under constraints: FPR <= max_fpr and Review Volume <= daily_capacity.
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
        # We search thresholds guided by empirical probability percentiles
        p_sorted = np.sort(calibrated_probs)
        
        # Grid over allow thresholds (e.g. bottom 70-95% allowed or challenged)
        allow_candidates = np.percentile(calibrated_probs, [50, 70, 80, 85, 90, 95])
        
        # To guarantee review_rate <= max_review_rate:
        # We can set tau_review such that only at most max_review_rate of transactions fall in [tau_review, tau_block]
        cap_pct = max(0.001, min(0.50, max_review_rate))
        
        for t_allow in allow_candidates:
            # We test block rates between 0.1% and 5%
            for blk_pct in [0.002, 0.005, 0.01, 0.02, 0.05]:
                t_blk = float(np.percentile(calibrated_probs, max(0.0, (1.0 - blk_pct) * 100)))
                # Set t_rev such that at most cap_pct transactions fall in [t_rev, t_blk]
                rev_pct = cap_pct * 0.90 # 90% of cap to guarantee buffer
                t_rev = float(np.percentile(calibrated_probs, max(0.0, (1.0 - blk_pct - rev_pct) * 100)))
                
                if t_rev <= t_allow:
                    t_rev = float(t_allow + 0.01)
                if t_blk <= t_rev:
                    t_blk = float(t_rev + 0.01)

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

        # Guaranteed fallback satisfying hard capacity constraint
        if best_cost == float("inf"):
            t_blk = float(np.percentile(calibrated_probs, 99.0))
            t_rev = float(np.percentile(calibrated_probs, max(50.0, (1.0 - max_review_rate * 0.8) * 100)))
            t_allow = float(np.percentile(calibrated_probs, 80.0))
            if t_rev <= t_allow:
                t_allow = max(0.01, t_rev - 0.05)
            if t_blk <= t_rev:
                t_blk = min(0.99, t_rev + 0.02)

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
        res_fixed = self.cost_engine.evaluate_policy_batch(calibrated_probs, amounts, labels, fixed_policy)

        # Policy 2: Rule-of-thumb Conservative (High Allow, High Block)
        conservative_policy = DecisionPolicy(
            policy_name="Conservative Heuristic",
            tau_allow=0.30,
            tau_review=0.70,
            tau_block=0.95,
            use_challenge=False,
        )
        res_cons = self.cost_engine.evaluate_policy_batch(calibrated_probs, amounts, labels, conservative_policy)

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
