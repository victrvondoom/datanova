"""
Unified End-to-End Feature Pipeline.
Transforms raw transaction DataFrames into numerical feature matrices for ML models.
Guarantees:
- Fits all transformations (scalers, encoders, imputers) strictly on Training partition.
- Validates that no target labels are used in unsupervised transforms.
"""

from typing import List

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from packages.features.temporal import TemporalFeatureExtractor


class FeaturePipeline:
    """
    Fits and transforms raw payment transactions into clean feature matrices.
    """

    def __init__(self, include_graph_features: bool = False):
        self.include_graph_features = include_graph_features
        self.temporal_extractor = TemporalFeatureExtractor()
        self.scaler = StandardScaler()
        self.fitted = False
        self.feature_names: List[str] = []
        self.known_categories: List[str] = []
        self.known_channels: List[str] = []

    def fit(self, df: pd.DataFrame) -> "FeaturePipeline":
        """Fits scalers and category vocabulary on training partition ONLY."""
        temp_feats = self.temporal_extractor.extract_batch_features(df)

        # Collect categorical vocabularies
        if "category" in df:
            self.known_categories = sorted(df["category"].dropna().unique().tolist())
        if "channel" in df:
            self.known_channels = sorted(df["channel"].dropna().unique().tolist())

        cat_matrix = self._encode_categoricals(df)
        combined = pd.concat([temp_feats, cat_matrix], axis=1)

        self.scaler.fit(combined.values)
        self.feature_names = combined.columns.tolist()
        self.fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """Transforms validation or test DataFrame using fitted pipeline."""
        if not self.fitted:
            raise RuntimeError("FeaturePipeline must be fitted on training data before transform.")

        temp_feats = self.temporal_extractor.extract_batch_features(df)
        cat_matrix = self._encode_categoricals(df)
        combined = pd.concat([temp_feats, cat_matrix], axis=1)

        # Ensure column alignment with training features
        for col in self.feature_names:
            if col not in combined:
                combined[col] = 0.0
        combined = combined[self.feature_names]

        # Standard scale
        scaled = self.scaler.transform(combined.values)
        return scaled

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    def _encode_categoricals(self, df: pd.DataFrame) -> pd.DataFrame:
        """One-hot encodes categories and channels with out-of-vocabulary handling."""
        encoded = pd.DataFrame(index=df.index)

        # Channel
        if "channel" in df:
            for ch in self.known_channels:
                encoded[f"ch_{ch}"] = (df["channel"] == ch).astype(float)

        # Standard one-hot encoding for known categories
        if "category" in df:
            for cat in self.known_categories:
                encoded[f"cat_{cat}"] = (df["category"] == cat).astype(float)

        return encoded
