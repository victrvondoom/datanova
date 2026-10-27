"""Integration tests for FastAPI endpoints."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from apps.api.main import app, startup_event

client = TestClient(app)

# Run startup event
startup_event()


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "model_id" in data


def test_api_score_transaction():
    payload = {
        "transaction_id": "api_test_001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_0001",
        "receiver_id": "merch_001",
        "amount": 450.00,
        "currency": "USD",
        "channel": "mobile",
        "device_id": "dev_test",
        "category": "retail",
    }
    res = client.post("/api/score", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "calibrated_probability" in data
    assert 0.0 <= data["calibrated_probability"] <= 1.0
    assert data["recommended_action"] in ["ALLOW", "CHALLENGE", "REVIEW", "BLOCK"]
    assert "audit_receipt_hash" in data
    assert len(data["audit_receipt_hash"]) == 64 # SHA-256 length


def test_api_benchmarks():
    res = client.get("/api/benchmarks")
    assert res.status_code == 200
    data = res.json()
    assert "benchmark_summary" in data


def test_api_graph_subgraph():
    res = client.get("/api/graph/subgraph?limit_nodes=20")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data


def test_api_replay_batch():
    res = client.get("/api/stream/replay-batch?offset=0&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["records"]) == 10
    assert "cumulative_summary" in data


def test_api_drift_evaluate():
    res = client.post("/api/drift/evaluate")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "amount_psi" in data


def test_api_stream_inject():
    payload = {
        "sender_id": "usr_test_inject",
        "receiver_id": "merch_inject",
        "amount": 2500.0,
        "channel": "mobile",
        "device_id": "dev_test_inject",
        "category": "wire_transfer",
        "is_fraud_simulated": 1,
    }
    res = client.post("/api/stream/inject", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "injected"
    assert "score_result" in data
    assert "calibrated_probability" in data["score_result"]
    assert "audit_receipt_hash" in data["score_result"]


def test_api_optimize_policy():
    payload = {
        "investigation_cost": 20.0,
        "customer_friction_cost": 10.0,
        "friction_block_cost": 30.0,
        "max_fpr": 0.015,
        "review_capacity_daily": 80,
    }
    res = client.post("/api/optimize-policy", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "active_policy" in data
    assert "comparisons" in data
    assert "aegis_cost_optimized" in data["comparisons"]


def test_api_simulate_stress():
    payload = {"scenario": "smurfing"}
    res = client.post("/api/drift/simulate-stress", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["scenario"] == "smurfing"
    assert "amount_psi" in data
    assert "alert_level" in data


def test_api_receipt_verify():
    # First score a transaction to get a real receipt
    payload = {
        "transaction_id": "tx_receipt_ver_01",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_rec_01",
        "receiver_id": "merch_rec_01",
        "amount": 350.00,
        "currency": "USD",
        "channel": "mobile",
        "device_id": "dev_rec",
        "category": "retail",
    }
    score_res = client.post("/api/score", json=payload)
    assert score_res.status_code == 200

    # Obtain receipt from audit receipt generator
    from apps.api.main import state

    receipt_obj = state.receipt_gen.create_receipt(
        transaction_id="tx_receipt_ver_01",
        model_id="aegis_champion",
        model_version="1.0",
        calibrated_probability=score_res.json()["calibrated_probability"],
        recommended_action=score_res.json()["recommended_action"],
        financial_cost_estimate=350.0,
        top_features=[],
        timestamp=datetime.now(timezone.utc),
    )
    receipt_dict = receipt_obj.model_dump()
    receipt_dict["timestamp"] = receipt_dict["timestamp"].isoformat()

    # Verify authentic receipt
    res = client.post("/api/receipts/verify", json={"receipt": receipt_dict})
    assert res.status_code == 200
    assert res.json()["is_valid"] is True
    assert res.json()["status"] == "VALID_AUTHENTIC"

    # Verify tampered receipt
    tampered_dict = dict(receipt_dict)
    tampered_dict["calibrated_probability"] = 0.0001
    res_tamper = client.post("/api/receipts/verify", json={"receipt": tampered_dict})
    assert res_tamper.status_code == 200
    assert res_tamper.json()["is_valid"] is False
    assert res_tamper.json()["status"] == "TAMPERED_OR_CORRUPT"
