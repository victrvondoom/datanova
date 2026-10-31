"""Integration tests for Milestone 3 batch B.

Catalog features covered:
- inv_model_output_inspection / NEXT-B1: archived decision retrieval + listing
- obs_structured_logging / obs_model_version_logging: provenance-complete
  structured decision logs (no payloads)
- monitor_metrics_endpoint / api_usage_analytics: process-local ops counters
- ops_kill_switch: emergency stop forces REVIEW on every decision; readiness
  reports the engaged state
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from apps.api.main import app, startup_event

client = TestClient(app)
startup_event()


@pytest.fixture(autouse=True)
def _isolated_integrity_state():
    """Reset shared integrity state between tests."""
    from apps.api.main import state

    state.require(state.rate_limiter)._buckets.clear()
    state.emergency_stop_engaged = False
    yield
    state.emergency_stop_engaged = False
    state.require(state.rate_limiter)._buckets.clear()


def _score(tx_id: str, amount: float = 300.0) -> dict:
    payload = {
        "transaction_id": tx_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_batchb_01",
        "receiver_id": "merch_batchb_01",
        "amount": amount,
        "currency": "USD",
        "channel": "mobile",
        "device_id": "dev_batchb",
        "category": "retail",
    }
    res = client.post("/api/score", json=payload)
    assert res.status_code == 200, res.text
    return res.json()


def test_decision_archive_retrieval_and_listing():
    """First-time decisions are archived and retrievable by id and page."""
    from apps.api.main import state

    ledger = state.require(state.decision_ledger)
    before = len(ledger)

    scored = _score("tx_batchb_lookup_001")
    _score("tx_batchb_lookup_002")

    # Point retrieval matches the decision exactly
    res = client.get("/api/decisions/tx_batchb_lookup_001")
    assert res.status_code == 200
    record = res.json()
    assert record["receipt_sha256"] == scored["audit_receipt_hash"]
    assert record["calibrated_probability"] == scored["calibrated_probability"]
    assert record["model_id"] == scored["model_id"]
    assert record["calibration_source"] == "validation-artifact"
    assert record["artifact_run_id"] is not None

    # Unknown id -> honest 404
    assert client.get("/api/decisions/never_scored_xyz").status_code == 404

    # Listing is bounded and contains both new records (order-independent:
    # the ledger is shared process-wide across the test session)
    listing = client.get("/api/decisions?limit=200&offset=0").json()
    assert listing["count"] == len(ledger) == before + 2
    ids = [r["transaction_id"] for r in listing["records"]]
    assert "tx_batchb_lookup_001" in ids
    assert "tx_batchb_lookup_002" in ids

    # Paging beyond the archive is empty, not an error
    tail = client.get(f"/api/decisions?limit=5&offset={len(ledger)}").json()
    assert tail["records"] == []


def test_decision_logs_carry_provenance_and_no_payload(caplog):
    """Decision log lines contain provenance; transaction payloads are absent."""
    with caplog.at_level(logging.INFO, logger="aegis.decisions"):
        _score("tx_batchb_logging_001")

    decision_lines = [
        r.getMessage() for r in caplog.records if r.name == "aegis.decisions"
    ]
    assert decision_lines, "no structured decision log line was emitted"
    entry = json.loads(decision_lines[-1])

    assert entry["event"] == "decision"
    assert entry["transaction_id"] == "tx_batchb_logging_001"
    assert entry["model_id"]
    assert entry["model_version"]
    assert entry["policy_name"]
    assert entry["calibration_source"] == "validation-artifact"
    assert entry["artifact_run_id"]
    assert isinstance(entry["calibrated_probability"], float)
    assert entry["action"] in ("ALLOW", "CHALLENGE", "REVIEW", "BLOCK")
    assert len(entry["receipt_sha256"]) == 64
    # No payload minimization violations: sender/receiver/amount must not be logged
    assert "sender_id" not in entry
    assert "receiver_id" not in entry
    assert "amount" not in entry
    assert "device_id" not in entry


def test_metrics_counters_reconcile_with_requests():
    """Ops counters must exactly match a scripted request sequence."""
    from apps.api.integrity import metrics

    snapshot_before = metrics.snapshot()["counters"]
    before_health = snapshot_before.get("requests:/api/health", 0)
    before_2xx = snapshot_before.get("responses:2xx", 0)

    n_health = 3
    for _ in range(n_health):
        client.get("/api/health")

    counters = metrics.snapshot()["counters"]
    assert counters["requests:/api/health"] == before_health + n_health
    assert counters["responses:2xx"] >= before_2xx + n_health

    # A 429 burst must land in the rate_limited counter
    for i in range(150):
        res = client.post(
            "/api/score",
            json={
                "transaction_id": f"tx_batchb_rl_{i}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sender_id": "u1",
                "receiver_id": "m1",
                "amount": 10.0,
                "channel": "web",
            },
        )
        if res.status_code == 429:
            break
    counters_after = metrics.snapshot()["counters"]
    assert counters_after.get("rate_limited", 0) >= 1

    # 404s are counted as 4xx
    missing_before = counters_after.get("responses:4xx", 0)
    client.get("/api/decisions/definitely_missing_id")
    assert metrics.snapshot()["counters"]["responses:4xx"] == missing_before + 1


def test_emergency_stop_forces_review_on_every_decision():
    """Engaged kill switch: every decision becomes REVIEW until disengaged."""
    # Engage
    res = client.post("/api/admin/emergency-stop", json={"engaged": True})
    assert res.status_code == 200
    assert res.json()["engaged"] is True

    # Readiness must honestly report that the engine cannot auto-decide
    ready = client.get("/api/ready").json()
    assert ready["ready"] is False
    assert ready["emergency_stop_engaged"] is True
    assert ready["checks"]["emergency_stop_clear"] is False

    # Every action is REVIEW regardless of the model score
    for tx_id, amount in (("tx_batchb_stop_low", 5.0), ("tx_batchb_stop_high", 4500.0)):
        scored = _score(tx_id, amount=amount)
        assert scored["recommended_action"] == "REVIEW", (
            f"Kill switch engaged but {tx_id} got {scored['recommended_action']}"
        )
        record = client.get(f"/api/decisions/{tx_id}").json()
        assert record["emergency_stop_engaged"] is True

    # Disengage: normal decisioning returns and readiness recovers
    client.post("/api/admin/emergency-stop", json={"engaged": False})
    assert client.get("/api/ready").json()["ready"] is True
    scored = _score("tx_batchb_stop_after", amount=5.0)
    assert scored["recommended_action"] in ("ALLOW", "CHALLENGE", "REVIEW", "BLOCK")
    record = client.get("/api/decisions/tx_batchb_stop_after").json()
    assert record["emergency_stop_engaged"] is False
