"""
Expert Heuristic Rule Engine (Industry Baseline).
Represents conventional rule-based fraud detection systems deployed in legacy banking.
Rules include:
1. High single transaction amount (> $5,000)
2. Extreme short-term velocity (> 3 tx in 1 hour)
3. High-risk category with sudden large ticket (> $2,500)
4. Multi-device proliferation in 24 hours
"""

from typing import List, Optional
import numpy as np
from packages.models.base import BaseFraudClassifier


class RuleBasedFraudClassifier(BaseFraudClassifier):
    """Deterministic rule-based baseline."""

    def __init__(self):
        super().__init__(model_id="rule_baseline_v1", version="1.0.0")

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None) -> "RuleBasedFraudClassifier":
        self.feature_names = feature_names or []
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Evaluates rule conditions based on feature indices.
        Outputs heuristic confidence score [0.0 - 0.95].
        """
        n_samples = X.shape[0]
        scores = np.zeros(n_samples, dtype=np.float32)

        # Map feature names to indices if available
        f_map = {name: i for i, name in enumerate(self.feature_names)}

        for i in range(n_samples):
            rule_flags = 0

            # Rule 1: High amount
            if "log_amount" in f_map:
                log_amt = X[i, f_map["log_amount"]]
                if log_amt > np.log1p(5000.0):
                    rule_flags += 2

            # Rule 2: 1-hour velocity surge
            if "tx_count_1h" in f_map:
                if X[i, f_map["tx_count_1h"]] >= 3.0:
                    rule_flags += 2

            # Rule 3: Ratio to 24h mean
            if "amount_ratio_24h" in f_map:
                if X[i, f_map["amount_ratio_24h"]] >= 5.0:
                    rule_flags += 2

            # Rule 4: Device proliferation
            if "distinct_devices_24h" in f_map:
                if X[i, f_map["distinct_devices_24h"]] >= 2.0:
                    rule_flags += 1

            # Convert rule hits into probability surrogate
            if rule_flags >= 4:
                scores[i] = 0.90
            elif rule_flags >= 2:
                scores[i] = 0.65
            elif rule_flags == 1:
                scores[i] = 0.30
            else:
                scores[i] = 0.02

        return scores
