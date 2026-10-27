"""Unit tests for feature extraction and pipeline."""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
from packages.data.synthetic import SyntheticTransactionGenerator
from packages.data.splitters import ChronologicalSplitter
from packages.features.pipeline import FeaturePipeline
from packages.features.temporal import TemporalFeatureExtractor


def test_temporal_feature_extractor():
    gen = SyntheticTransactionGenerator(seed=42)
    df = gen.generate_stream(n_transactions=200, fraud_ratio=0.05)

    extractor = TemporalFeatureExtractor()
    feats = extractor.extract_batch_features(df)

    assert "log_amount" in feats.columns
    assert "tx_count_1h" in feats.columns
    assert "distinct_devices_24h" in feats.columns
    assert len(feats) == len(df)
    assert not feats.isna().any().any()


def test_feature_pipeline_fit_on_train_only():
    gen = SyntheticTransactionGenerator(seed=42)
    df = gen.generate_stream(n_transactions=500, fraud_ratio=0.02)

    splitter = ChronologicalSplitter(0.6, 0.2, 0.2)
    train_df, val_df, test_df = splitter.split(df)

    pipe = FeaturePipeline()
    X_train = pipe.fit_transform(train_df)
    X_test = pipe.transform(test_df)

    assert X_train.shape[1] == X_test.shape[1]
    assert np.all(np.isfinite(X_train))
    assert np.all(np.isfinite(X_test))
