"""
Adapter for Seeded Synthetic Transactions.
Provides guaranteed deterministic data access for CI, unit testing, local onboarding,
and failure-injection experiments without requiring external files.
"""

from datetime import datetime

import pandas as pd

from packages.data.synthetic import SyntheticTransactionGenerator


class SyntheticDataAdapter:
    """Standardized adapter for synthetic transactions."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.generator = SyntheticTransactionGenerator(seed=seed)

    def is_available(self) -> bool:
        return True

    def load_and_standardize(
        self,
        n_transactions: int = 10000,
        fraud_ratio: float = 0.02,
        start_time: datetime = datetime(2026, 1, 1, 0, 0, 0),
    ) -> pd.DataFrame:
        return self.generator.generate_stream(
            n_transactions=n_transactions,
            fraud_ratio=fraud_ratio,
            start_time=start_time,
        )
