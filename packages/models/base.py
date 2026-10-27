"""
Base Class and Protocols for Fraud Detection Models.
Standardizes training, inference, probability output, and serialization.
"""

from abc import ABC, abstractmethod
import os
import pickle
from typing import Any, Dict, List, Optional
import numpy as np


class BaseFraudClassifier(ABC):
    """Abstract base class for all AEGIS-Fraud X detection models."""

    def __init__(self, model_id: str, version: str = "1.0.0"):
        self.model_id = model_id
        self.version = version
        self.fitted = False
        self.feature_names: List[str] = []

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None) -> "BaseFraudClassifier":
        """Fits model on training features X and binary labels y."""
        pass

    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Returns 1D array of fraud probabilities P(Y=1 | X)."""
        pass

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Assigns binary labels {0, 1} based on operating threshold."""
        probs = self.predict_proba(X)
        return (probs >= threshold).astype(int)

    def save(self, filepath: str):
        """Serializes model to disk."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, filepath: str) -> "BaseFraudClassifier":
        """Loads serialized model from disk."""
        with open(filepath, "rb") as f:
            return pickle.load(f)
