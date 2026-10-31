"""
Chronological Splitting Engine with Zero Lookahead Guarantees.
Enforces strict temporal ordering: Train -> Validation -> Test.
Prevents data leakage and ensures transformers only fit on historical training data.
"""

import hashlib
from typing import Tuple

import pandas as pd

from packages.data.schemas import DatasetManifest


class ChronologicalSplitter:
    """
    Partitions transactional data chronologically.
    Guarantees that no future information leaks into training or validation.
    """

    def __init__(
        self,
        train_ratio: float = 0.60,
        val_ratio: float = 0.20,
        test_ratio: float = 0.20,
    ):
        if not (0.999 <= (train_ratio + val_ratio + test_ratio) <= 1.001):
            raise ValueError("Split ratios must sum to 1.0.")
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.test_ratio = test_ratio

    def split(
        self,
        df: pd.DataFrame,
        time_col: str = "timestamp",
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Splits DataFrame chronologically.
        Returns: (train_df, val_df, test_df)
        """
        if df.empty:
            raise ValueError("Cannot split an empty DataFrame.")

        # Ensure sorted by time
        sorted_df = df.sort_values(time_col).reset_index(drop=True)
        n = len(sorted_df)

        train_end = int(n * self.train_ratio)
        val_end = train_end + int(n * self.val_ratio)

        train_df = sorted_df.iloc[:train_end].copy().reset_index(drop=True)
        val_df = sorted_df.iloc[train_end:val_end].copy().reset_index(drop=True)
        test_df = sorted_df.iloc[val_end:].copy().reset_index(drop=True)

        # Invariant checks
        if not train_df.empty and not val_df.empty:
            assert train_df[time_col].max() <= val_df[time_col].min(), (
                "Temporal leakage detected: Train max timestamp exceeds Validation min timestamp!"
            )
        if not val_df.empty and not test_df.empty:
            assert val_df[time_col].max() <= test_df[time_col].min(), (
                "Temporal leakage detected: Validation max timestamp exceeds Test min timestamp!"
            )

        return train_df, val_df, test_df

    def create_manifest(
        self,
        df: pd.DataFrame,
        dataset_name: str,
        source_origin: str,
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
        test_df: pd.DataFrame,
        time_col: str = "timestamp",
        label_col: str = "is_fraud",
    ) -> DatasetManifest:
        """Computes verifiable cryptographic checksum and partition statistics."""
        # Checksum over sorted transaction IDs and amounts
        data_digest = hashlib.sha256(
            (str(df["transaction_id"].tolist()) + str(df["amount"].tolist())).encode("utf-8")
        ).hexdigest()

        fraud_count = int(df[label_col].sum()) if label_col in df else 0
        prevalence = float(fraud_count / len(df)) if len(df) > 0 else 0.0

        start_ts = df[time_col].min()
        end_ts = df[time_col].max()

        manifest = DatasetManifest(
            dataset_name=dataset_name,
            source_url_or_origin=source_origin,
            record_count=len(df),
            fraud_count=fraud_count,
            fraud_prevalence=round(prevalence, 6),
            start_timestamp=start_ts.to_pydatetime()
            if hasattr(start_ts, "to_pydatetime")
            else start_ts,
            end_timestamp=end_ts.to_pydatetime() if hasattr(end_ts, "to_pydatetime") else end_ts,
            sha256_checksum=data_digest,
            split_strategy=f"Chronological_{int(self.train_ratio * 100)}_{int(self.val_ratio * 100)}_{int(self.test_ratio * 100)}",
            train_count=len(train_df),
            val_count=len(val_df),
            test_count=len(test_df),
        )
        return manifest
