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
        Loads the ULB CSV and standardizes it via `standardize_frame`.
        """
        if not self.is_available():
            raise FileNotFoundError(
                f"ULB dataset not found at '{self.data_path}'. "
                "Download creditcard.csv and place it in datasets/external/ to run real-world ULB benchmarks."
            )
        df = pd.read_csv(self.data_path, nrows=sample_limit)
        return self.standardize_frame(df, base_timestamp=base_timestamp)

    def standardize_frame(
        self,
        df: pd.DataFrame,
        base_timestamp: datetime = datetime(2026, 1, 1, 0, 0, 0),
    ) -> pd.DataFrame:
        """
        Standardizes an in-memory ULB frame (columns Time, Amount, Class, V1..V28).

        The sort is STABLE: ULB rows arrive chronologically and many share the
        same 'Time' second; an unstable sort would shuffle rows within a second
        and silently misalign any caller-supplied data with the sorted output.
        """
        df = df.reset_index(drop=True)

        # Check required columns
        required = {"Time", "Amount", "Class"}
        if not required.issubset(df.columns):
            raise ValueError(f"ULB dataset missing mandatory columns: {required - set(df.columns)}")

        df = df.copy()

        # Convert Time (elapsed seconds) to chronological timestamp
        df["timestamp"] = [base_timestamp + timedelta(seconds=float(s)) for s in df["Time"]]
        df["is_fraud"] = df["Class"].astype(int)
        df["amount"] = df["Amount"].astype(float)

        # Create stable synthetic transaction IDs
        df["transaction_id"] = [f"ulb_tx_{i:07d}" for i in range(len(df))]

        # Sender/receiver: ULB is card-level anonymized PCA data with NO
        # account, customer, or merchant identifiers. We must NOT fabricate
        # recurring entity identities (fake "accounts" would create bogus
        # graph relationships). Each row gets a unique pseudo-ID and a fixed
        # anonymized counterparty; downstream graph features are therefore
        # meaningless for ULB and must not be computed on this dataset.
        df["sender_id"] = [f"ulb_anon_{i:07d}" for i in range(len(df))]
        df["receiver_id"] = "ulb_anonymized_counterparty"
        df["channel"] = "pos"
        df["dataset_designation"] = DatasetDesignation.ULB_CREDIT_CARD.value

        # Ensure chronological ordering with a STABLE sort (ties keep their
        # original relative order; an unstable sort would reshuffle rows that
        # share the same second and desynchronize downstream consumers).
        df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)
        return df
