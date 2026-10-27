"""
Controlled Adversarial & Operational Stress Testing Laboratory.
Simulates non-operational defensive stress scenarios:
1. Scenario A: Volume Surge (e.g. 5x transaction rate during sales event)
2. Scenario B: Smurfing Attack (Structuring amounts just below threshold to evade rules)
3. Scenario C: Device Fingerprint Spoofing (Rapid proxy rotation)
4. Scenario D: Delayed Fraud Label Latency (30-day reporting lag)
Tracks detection latency, degraded calibration, and retraining impact.
"""

from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

from packages.data.schemas import CostConfiguration, DecisionPolicy
from packages.evaluation.metrics import FraudEvaluationMetrics
from packages.models.base import BaseFraudClassifier
from packages.models.calibration import ProbabilityCalibrator


class StressTestingLab:
    """Simulates adversarial and environmental shocks to evaluate defense robustness."""

    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)

    def simulate_smurfing_attack(
        self,
        df: pd.DataFrame,
        attack_fraction: float = 0.15,
        threshold_ceiling: float = 4900.0,
    ) -> pd.DataFrame:
        """
        Adversaries split high-value fraud into multiple structured amounts below reporting rules ($4,900).
        """
        stressed = df.copy()
        fraud_mask = (stressed["is_fraud"] == 1)
        fraud_indices = stressed[fraud_mask].index.tolist()
        
        target_indices = self.rng.choice(fraud_indices, size=int(len(fraud_indices) * attack_fraction), replace=False)
        for idx in target_indices:
            # Structuring: amounts between $4,500 and $4,890
            stressed.loc[idx, "amount"] = float(threshold_ceiling - self.rng.uniform(10.0, 390.0))
            stressed.loc[idx, "category"] = "money_transfer"

        return stressed

    def simulate_device_spoofing(
        self,
        df: pd.DataFrame,
        spoof_fraction: float = 0.25,
    ) -> pd.DataFrame:
        """
        Adversaries rotate random fake device IDs to evade single-device velocity checks.
        """
        stressed = df.copy()
        fraud_mask = (stressed["is_fraud"] == 1)
        fraud_indices = stressed[fraud_mask].index.tolist()

        target_indices = self.rng.choice(fraud_indices, size=int(len(fraud_indices) * spoof_fraction), replace=False)
        for idx in target_indices:
            stressed.loc[idx, "device_id"] = f"spoofed_dev_{self.rng.integers(100000, 999999)}"
            stressed.loc[idx, "ip_address"] = f"proxy_{self.rng.integers(1, 255)}.{self.rng.integers(1, 255)}.1.1"

        return stressed

    def benchmark_stress_resilience(
        self,
        model: BaseFraudClassifier,
        calibrator: ProbabilityCalibrator,
        feature_transform_fn,
        clean_test_df: pd.DataFrame,
        stressed_test_df: pd.DataFrame,
        cost_config: CostConfiguration = CostConfiguration(),
    ) -> Dict[str, Dict]:
        """
        Compares model performance on clean vs stressed data to measure degradation.
        """
        # 1. Clean evaluation
        X_clean = feature_transform_fn(clean_test_df)
        y_clean = clean_test_df["is_fraud"].values
        amt_clean = clean_test_df["amount"].values

        raw_clean = model.predict_proba(X_clean)
        prob_clean = calibrator.calibrate(raw_clean)
        res_clean = FraudEvaluationMetrics.evaluate(y_clean, prob_clean, amt_clean, cost_config=cost_config)

        # 2. Stressed evaluation
        X_stress = feature_transform_fn(stressed_test_df)
        y_stress = stressed_test_df["is_fraud"].values
        amt_stress = stressed_test_df["amount"].values

        raw_stress = model.predict_proba(X_stress)
        prob_stress = calibrator.calibrate(raw_stress)
        res_stress = FraudEvaluationMetrics.evaluate(y_stress, prob_stress, amt_stress, cost_config=cost_config)

        # Calculate degradation deltas
        delta_pr_auc = round(res_stress["pr_auc"] - res_clean["pr_auc"], 4)
        delta_cost = round(
            res_stress["financial_outcomes"]["total_operational_cost"]
            - res_clean["financial_outcomes"]["total_operational_cost"],
            2,
        )

        return {
            "clean_baseline": {
                "pr_auc": res_clean["pr_auc"],
                "recall_at_1pct_fpr": res_clean["recall_at_fpr_1pct"],
                "total_operational_cost": res_clean["financial_outcomes"]["total_operational_cost"],
            },
            "stressed_scenario": {
                "pr_auc": res_stress["pr_auc"],
                "recall_at_1pct_fpr": res_stress["recall_at_fpr_1pct"],
                "total_operational_cost": res_stress["financial_outcomes"]["total_operational_cost"],
            },
            "resilience_summary": {
                "pr_auc_degradation": delta_pr_auc,
                "additional_cost_incurred": delta_cost,
                "is_resilient": bool(delta_pr_auc >= -0.05),
            },
        }
