"""
Adapter for ULB Credit Card Fraud Dataset (Real Anonymized Transactions).
Reference: Andrea Dal Pozzolo et al., Université Libre de Bruxelles (ULB).
Fields: Time (seconds elapsed from first transaction), V1-V28 (PCA transformed features), Amount, Class.
Strict rule: Does NOT invent fake account identities or relationships for ULB.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from packages.data.schemas import DatasetDesignation


class ULBCreditCardAdapter:
    """
    Loads and standardizes the ULB Credit Card fraud dataset.
    Preserves anonymized PCA components V1..V28 and transforms 'Time' into chronological timestamps.
    """

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = data_path or os.path.join("datasets", "external", "creditcard.csv")

    def is_available(self) -> bool:
        """Returns True if the physical dataset exists locally."""
        return os.path.exists(self.data_path)

    def load_and_standardize(
        self,
        base_timestamp: datetime = datetime(2026, 1, 1, 0, 0, 0),
        sample_limit: Optional[int] = None,
    ) -> pd.DataFrame:
        """
        Loads the ULB CSV, standardizes column names, computes realistic timestamps from 'Time' delta,
        and returns clean DataFrame.
        """
        if not self.is_available():
            raise FileNotFoundError(
                f"ULB dataset not found at '{self.data_path}'. "
                "Download creditcard.csv and place it in datasets/external/ to run real-world ULB benchmarks."
            )

        df = pd.read_csv(self.data_path, nrows=sample_limit)

        # Check required columns
        required = {"Time", "Amount", "Class"}
        if not required.issubset(df.columns):
            raise ValueError(f"ULB dataset missing mandatory columns: {required - set(df.columns)}")

        # Convert Time (elapsed seconds) to chronological timestamp
        df["timestamp"] = [base_timestamp + timedelta(seconds=float(s)) for s in df["Time"]]
        df["is_fraud"] = df["Class"].astype(int)
        df["amount"] = df["Amount"].astype(float)

        # Create stable synthetic transaction IDs
        df["transaction_id"] = [f"ulb_tx_{i:07d}" for i in range(len(df))]

        # Sender/receiver: ULB is card-level anonymized without merchant identifiers
        df["sender_id"] = [f"ulb_card_{i % 5000:05d}" for i in range(len(df))]
        df["receiver_id"] = "anonymized_merchant"
        df["channel"] = "pos"
        df["dataset_designation"] = DatasetDesignation.ULB_CREDIT_CARD.value

        # Ensure chronological ordering
        df = df.sort_values("timestamp").reset_index(drop=True)
        return df
