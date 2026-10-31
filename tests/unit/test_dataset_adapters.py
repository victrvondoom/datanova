"""Contract tests for the external dataset adapters (ULB, PaySim).

These use small schema-valid FIXTURE files that follow the documented source
schemas. They are NOT the real datasets and make no claim to be. The purpose
is to pin the adapters' contracts: schema validation, label normalization,
timestamp construction, stable ordering, and the no-fabricated-entities rule
for ULB.
"""

import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.data.adapters.paysim import PaySimAdapter
from packages.data.adapters.ulb import ULBCreditCardAdapter

ULB_COLUMNS = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount", "Class"]
PAYSIM_COLUMNS = [
    "step", "type", "amount", "nameOrig", "oldbalanceOrg",
    "newbalanceOrig", "nameDest", "oldbalanceDest", "newbalanceDest",
    "isFraud", "isFlaggedFraud",
]


def _write_ulb_fixture(tmp_path):
    rows = [
        # Time, Amount, Class — deliberately with tied Time values to test
        # stable ordering
        [10.0, 100.0, 0],
        [10.0, 250.0, 1],
        [3600.0, 40.0, 0],
        [7200.0, 900.0, 1],
    ]
    df = pd.DataFrame(rows, columns=["Time", "Amount", "Class"])
    for i in range(1, 29):
        df[f"V{i}"] = float(i) * 0.1
    path = tmp_path / "creditcard.csv"
    df.to_csv(path, index=False)
    return path, df


def _write_paysim_fixture(tmp_path):
    df = pd.DataFrame(
        [
            [1, "CASH_OUT", 5000.0, "C123", 10000.0, 5000.0, "M456", 0.0, 0.0, 1, 0],
            [1, "PAYMENT", 50.0, "C789", 200.0, 150.0, "M456", 0.0, 0.0, 0, 0],
            [2, "TRANSFER", 300.0, "C123", 5000.0, 4700.0, "C999", 0.0, 300.0, 0, 0],
        ],
        columns=PAYSIM_COLUMNS,
    )
    path = tmp_path / "paysim.csv"
    df.to_csv(path, index=False)
    return path, df


def test_ulb_adapter_missing_dataset_raises(tmp_path):
    adapter = ULBCreditCardAdapter(data_path=str(tmp_path / "nonexistent.csv"))
    assert adapter.is_available() is False
    with pytest.raises(FileNotFoundError):
        adapter.load_and_standardize()


def test_ulb_adapter_rejects_wrong_schema(tmp_path):
    path = tmp_path / "creditcard.csv"
    pd.DataFrame({"foo": [1, 2]}).to_csv(path, index=False)
    adapter = ULBCreditCardAdapter(data_path=str(path))
    with pytest.raises(ValueError):
        adapter.load_and_standardize()


def test_ulb_adapter_contract(tmp_path):
    path, raw = _write_ulb_fixture(tmp_path)
    adapter = ULBCreditCardAdapter(data_path=str(path))
    std = adapter.load_and_standardize()

    # Label and amount normalization
    assert std["is_fraud"].tolist() == raw["Class"].tolist()
    assert std["amount"].tolist() == raw["Amount"].tolist()
    # Chronological timestamps derived from Time
    assert std["timestamp"].is_monotonic_increasing
    # ULB has NO entity semantics: pseudo-IDs must be unique (no fabricated
    # recurring "accounts" that would imply fake relationships)
    assert std["sender_id"].is_unique
    assert (std["receiver_id"] == "ulb_anonymized_counterparty").all()
    # V-features preserved untouched
    assert "V1" in std.columns and "V28" in std.columns
    assert std["dataset_designation"].eq("ULB_CREDIT_CARD").all()


def test_ulb_adapter_sort_is_stable(tmp_path):
    """Rows sharing a timestamp must keep their original relative order."""
    path, _ = _write_ulb_fixture(tmp_path)
    adapter = ULBCreditCardAdapter(data_path=str(path))
    std = adapter.load_and_standardize()
    # The first two fixture rows share Time=10.0: stable sort keeps row order
    first_two = std["transaction_id"].head(2).tolist()
    assert first_two == ["ulb_tx_0000000", "ulb_tx_0000001"]


def test_paysim_adapter_missing_dataset_raises(tmp_path):
    adapter = PaySimAdapter(data_path=str(tmp_path / "nonexistent.csv"))
    assert adapter.is_available() is False
    with pytest.raises(FileNotFoundError):
        adapter.load_and_standardize()


def test_paysim_adapter_rejects_wrong_schema(tmp_path):
    path = tmp_path / "paysim.csv"
    pd.DataFrame({"step": [1]}).to_csv(path, index=False)
    adapter = PaySimAdapter(data_path=str(path))
    with pytest.raises(ValueError):
        adapter.load_and_standardize()


def test_paysim_adapter_contract(tmp_path):
    path, raw = _write_paysim_fixture(tmp_path)
    adapter = PaySimAdapter(data_path=str(path))
    std = adapter.load_and_standardize()

    # PaySim HAS real entity identifiers: preserved, not fabricated
    assert std["sender_id"].tolist() == raw["nameOrig"].tolist()
    assert std["receiver_id"].tolist() == raw["nameDest"].tolist()
    assert std["is_fraud"].tolist() == raw["isFraud"].tolist()
    assert std["amount"].tolist() == raw["amount"].tolist()
    assert std["timestamp"].is_monotonic_increasing
    assert std["dataset_designation"].eq("PAYSIM").all()
    # Stable ordering for rows sharing a step
    assert std["transaction_id"].head(2).tolist() == [
        "paysim_0000000",
        "paysim_0000001",
    ]
