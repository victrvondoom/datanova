"""
Cost-Aware Decision Engine and Multi-Action Operational Matrix.
Calculates expected financial loss, manual review expense, and customer friction for:
- ALLOW: Accept transaction (risk = full fraud loss if fraudulent)
- CHALLENGE: Automated 2FA/OTP (deterrence = 88%, minor friction cost)
- REVIEW: Route to human fraud investigator (high detection = 98%, review labor cost = $15)
- BLOCK: Immediate decline (prevents fraud loss, but causes high churn/friction if legitimate)
"""

from typing import Dict, List, Tuple
import numpy as np

from packages.data.schemas import CostConfiguration, DecisionPolicy, OperationalAction


class CostEngine:
    """Evaluates the economic outcomes of operational actions."""

    def __init__(self, config: CostConfiguration = CostConfiguration()):
        self.config = config

    def calculate_action_cost(
        self,
        action: OperationalAction,
        is_fraud: int,
        amount: float,
    ) -> float:
        """Computes true realized dollar cost given ground-truth label and transaction value."""
        if action == OperationalAction.ALLOW:
            # If fraud, bank absorbs 100% loss. If legit, $0 cost.
            return amount if is_fraud == 1 else 0.0

        elif action == OperationalAction.CHALLENGE:
            # Automated verification cost + residual fraud if challenge bypassed
            c_auto = self.config.challenge_cost
            if is_fraud == 1:
                uncaught_loss = (1.0 - self.config.challenge_efficiency) * amount
                return c_auto + uncaught_loss
            else:
                # Slight friction cost for legitimate user entering OTP
                return c_auto + (self.config.customer_friction_cost * 0.3)

        elif action == OperationalAction.REVIEW:
            # Manual investigation labor cost + residual fraud if missed
            c_inv = self.config.investigation_cost
            if is_fraud == 1:
                uncaught_loss = (1.0 - self.config.investigation_efficiency) * amount
                return c_inv + uncaught_loss
            else:
                # Legitimate customer delayed during manual queue
                return c_inv + self.config.customer_friction_cost

        elif action == OperationalAction.BLOCK:
            # Zero fraud loss, but massive friction/churn cost if false positive!
            if is_fraud == 1:
                return 0.0
            else:
                return self.config.friction_block_cost

        return 0.0

    def evaluate_policy_batch(
        self,
        calibrated_probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
        policy: DecisionPolicy,
    ) -> Dict[str, float]:
        """
        Calculates total operational cost, action distribution, and false positive rates for a given policy.
        """
        n = len(calibrated_probs)
        actions = []
        costs = []

        c_allow = 0
        c_challenge = 0
        c_review = 0
        c_block = 0

        fp_count = 0
        tn_count = 0

        for i in range(n):
            p = calibrated_probs[i]
            amt = amounts[i]
            y = labels[i]

            # Assign action based on policy thresholds
            if p < policy.tau_allow:
                act = OperationalAction.ALLOW
                c_allow += 1
            elif p < policy.tau_review:
                act = OperationalAction.CHALLENGE if policy.use_challenge else OperationalAction.REVIEW
                if act == OperationalAction.CHALLENGE:
                    c_challenge += 1
                else:
                    c_review += 1
            elif p < policy.tau_block:
                act = OperationalAction.REVIEW
                c_review += 1
            else:
                act = OperationalAction.BLOCK
                c_block += 1

            actions.append(act)
            cost = self.calculate_action_cost(act, y, amt)
            costs.append(cost)

            # Track false alarms (action != ALLOW on legitimate transaction)
            if y == 0:
                if act != OperationalAction.ALLOW:
                    fp_count += 1
                else:
                    tn_count += 1

        total_cost = float(np.sum(costs))
        fpr = float(fp_count / max(1, fp_count + tn_count))
        review_rate = float(c_review / max(1, n))

        # Baseline cost with zero fraud controls (allow 100%)
        baseline_cost = float(np.sum(amounts[labels == 1]))
        net_savings = max(0.0, baseline_cost - total_cost)

        return {
            "total_cost": round(total_cost, 2),
            "baseline_unmitigated_loss": round(baseline_cost, 2),
            "estimated_savings": round(net_savings, 2),
            "savings_ratio": round(net_savings / max(1.0, baseline_cost), 4),
            "false_positive_rate": round(fpr, 5),
            "review_rate": round(review_rate, 4),
            "action_counts": {
                "ALLOW": c_allow,
                "CHALLENGE": c_challenge,
                "REVIEW": c_review,
                "BLOCK": c_block,
            },
        }
