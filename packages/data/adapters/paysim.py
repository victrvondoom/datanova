"""
Adapter for PaySim Mobile Money Fraud Dataset (Simulated Multi-Agent Transactions).
Reference: Lopez-Rojas et al., PaySim: A financial mobile money simulator for fraud detection.
Fields: step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig, nameDest, oldbalanceDest, newbalanceDest, isFraud.
Ideal for account-relationship graph construction, mule ring detection, and transaction replay.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from packages.data.schemas import DatasetDesignation


class PaySimAdapter:
    """
    Loads and standardizes PaySim simulated mobile-money transactions.
    Explicitly tags the output as SIMULATED data to preserve scientific integrity.
    """

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = data_path or os.path.join("datasets", "external", "paysim.csv")

    def is_available(self) -> bool:
        return os.path.exists(self.data_path)

    def load_and_standardize(
        self,
        base_timestamp: datetime = datetime(2026, 1, 1, 0, 0, 0),
        sample_limit: Optional[int] = None,
    ) -> pd.DataFrame:
        if not self.is_available():
            raise FileNotFoundError(
                f"PaySim dataset not found at '{self.data_path}'. "
                "Place PaySim CSV in datasets/external/ to run full-scale graph benchmarks."
            )

        df = pd.read_csv(self.data_path, nrows=sample_limit)

        required = {"step", "type", "amount", "nameOrig", "nameDest", "isFraud"}
        if not required.issubset(df.columns):
            raise ValueError(f"PaySim missing required columns: {required - set(df.columns)}")

        # Step corresponds to hours (1 step = 1 hour)
        df["timestamp"] = [base_timestamp + timedelta(hours=int(s)) for s in df["step"]]
        df["transaction_id"] = [f"paysim_{i:07d}" for i in range(len(df))]
        df["sender_id"] = df["nameOrig"]
        df["receiver_id"] = df["nameDest"]
        df["amount"] = df["amount"].astype(float)
        df["is_fraud"] = df["isFraud"].astype(int)
        df["channel"] = df["type"].str.lower()
        df["category"] = df["type"].str.lower()
        df["dataset_designation"] = DatasetDesignation.PAYSIM.value

        # Stable sort: rows sharing a step (hour) keep their original relative
        # order so downstream consumers cannot be desynchronized.
        df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)
        return df
