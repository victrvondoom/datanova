"""
Machine Learning Classifiers for Payment Fraud Detection.
Implements:
1. Logistic Regression (L2 regularized, balanced class weight)
2. Random Forest (Bagged decision trees)
3. LightGBM (Gradient Boosted Decision Trees with imbalanced handling)
4. XGBoost (Extreme Gradient Boosting)
"""

from typing import List, Optional

import lightgbm as lgb
import numpy as np
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

from packages.models.base import BaseFraudClassifier


class LogisticRegressionFraudModel(BaseFraudClassifier):
    def __init__(self, C: float = 1.0, max_iter: int = 1000):
        super().__init__(model_id="logreg_baseline", version="1.0.0")
        self.clf = LogisticRegression(
            C=C, max_iter=max_iter, class_weight="balanced", random_state=42
        )

    def fit(
        self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None
    ) -> "LogisticRegressionFraudModel":
        self.feature_names = feature_names or []
        self.clf.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("Model is not fitted.")
        return np.asarray(self.clf.predict_proba(X))[:, 1]


class RandomForestFraudModel(BaseFraudClassifier):
    def __init__(self, n_estimators: int = 100, max_depth: int = 12):
        super().__init__(model_id="rf_baseline", version="1.0.0")
        self.clf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )

    def fit(
        self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None
    ) -> "RandomForestFraudModel":
        self.feature_names = feature_names or []
        self.clf.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("Model is not fitted.")
        return np.asarray(self.clf.predict_proba(X))[:, 1]


class LightGBMFraudModel(BaseFraudClassifier):
    def __init__(self, n_estimators: int = 150, learning_rate: float = 0.05, max_depth: int = 6):
        super().__init__(model_id="lightgbm_fraud_detector", version="1.2.0")
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self.clf: Optional[lgb.LGBMClassifier] = None

    def fit(
        self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None
    ) -> "LightGBMFraudModel":
        self.feature_names = feature_names or []
        pos_count = max(1, int(np.sum(y == 1)))
        neg_count = max(1, int(np.sum(y == 0)))
        scale_pos_weight = neg_count / pos_count

        self.clf = lgb.LGBMClassifier(
            n_estimators=self.n_estimators,
            learning_rate=self.learning_rate,
            max_depth=self.max_depth,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            verbose=-1,
            n_jobs=-1,
        )
        assert self.clf is not None, "LightGBM classifier not initialized"
        self.clf.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted or self.clf is None:
            raise RuntimeError("LightGBM model is not fitted.")
        return np.asarray(self.clf.predict_proba(X))[:, 1]


class XGBoostFraudModel(BaseFraudClassifier):
    def __init__(self, n_estimators: int = 150, learning_rate: float = 0.05, max_depth: int = 5):
        super().__init__(model_id="xgboost_fraud_detector", version="1.1.0")
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self.clf: Optional[xgb.XGBClassifier] = None

    def fit(
        self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None
    ) -> "XGBoostFraudModel":
        self.feature_names = feature_names or []
        pos_count = max(1, int(np.sum(y == 1)))
        neg_count = max(1, int(np.sum(y == 0)))
        scale_pos_weight = neg_count / pos_count

        self.clf = xgb.XGBClassifier(
            n_estimators=self.n_estimators,
            learning_rate=self.learning_rate,
            max_depth=self.max_depth,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            eval_metric="logloss",
            n_jobs=-1,
        )
        assert self.clf is not None, "XGBoost classifier not initialized"
        self.clf.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted or self.clf is None:
            raise RuntimeError("XGBoost model is not fitted.")
        return np.asarray(self.clf.predict_proba(X))[:, 1]
