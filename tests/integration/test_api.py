"""Integration tests for FastAPI endpoints."""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime
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
        "timestamp": datetime.utcnow().isoformat(),
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
