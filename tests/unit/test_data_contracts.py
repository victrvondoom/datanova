"""Unit tests for data contracts and chronological splitting."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime

import pytest
from pydantic import ValidationError

from packages.data.schemas import ChannelType, DatasetDesignation, Transaction
from packages.data.splitters import ChronologicalSplitter
from packages.data.synthetic import SyntheticTransactionGenerator


def test_transaction_schema_validation():
    # Valid transaction
    tx = Transaction(
        transaction_id="tx_001",
        timestamp=datetime(2026, 1, 1, 12, 0, 0),
        sender_id="usr_01",
        receiver_id="merch_01",
        amount=125.50,
        channel=ChannelType.MOBILE,
    )
    assert tx.amount == 125.50
    assert tx.dataset_designation == DatasetDesignation.SYNTHETIC

    # Invalid amount (negative or zero)
    with pytest.raises(ValidationError):
        Transaction(
            transaction_id="tx_bad",
            timestamp=datetime(2026, 1, 1, 12, 0, 0),
            sender_id="usr_01",
            receiver_id="merch_01",
            amount=-50.0,
        )


def test_synthetic_generator_determinism():
    gen1 = SyntheticTransactionGenerator(seed=42)
    df1 = gen1.generate_stream(n_transactions=500, fraud_ratio=0.02)

    gen2 = SyntheticTransactionGenerator(seed=42)
    df2 = gen2.generate_stream(n_transactions=500, fraud_ratio=0.02)

    # Identical seed must produce identical data
    assert df1["amount"].tolist() == df2["amount"].tolist()
    assert df1["is_fraud"].tolist() == df2["is_fraud"].tolist()
    assert df1["sender_id"].tolist() == df2["sender_id"].tolist()


def test_chronological_splitter_zero_lookahead():
    gen = SyntheticTransactionGenerator(seed=42)
    df = gen.generate_stream(n_transactions=1000, fraud_ratio=0.02)

    splitter = ChronologicalSplitter(train_ratio=0.6, val_ratio=0.2, test_ratio=0.2)
    train_df, val_df, test_df = splitter.split(df)

    assert len(train_df) == 600
    assert len(val_df) == 200
    assert len(test_df) == 200

    # Invariant: Train max time <= Val min time <= Test min time
    assert train_df["timestamp"].max() <= val_df["timestamp"].min()
    assert val_df["timestamp"].max() <= test_df["timestamp"].min()
