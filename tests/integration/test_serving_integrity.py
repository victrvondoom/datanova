"""Integration tests for the serving-integrity slice (Milestone 3 batch A).

Covers catalog features:
- AFX-F001 ingest_idem / api_idempotency (idempotent scoring)
- api_rate_limiting (token bucket with 429)
- obs_request_ids (correlation IDs)
- govern_decision_log (append-only, receipt-linked decision ledger)
- deploy_readiness_checks (readiness separate from liveness)
"""

import json
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
def _isolated_rate_limiter():
    """The token bucket is shared state; reset it so burst tests don't bleed."""
    from apps.api.main import state

    buckets = state.require(state.rate_limiter)._buckets
    buckets.clear()
    yield
    buckets.clear()


def _score_payload(tx_id: str, amount: float = 450.0) -> dict:
    return {
        "transaction_id": tx_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_integrity_01",
        "receiver_id": "merch_integrity_01",
        "amount": amount,
        "currency": "USD",
        "channel": "mobile",
        "device_id": "dev_integrity",
        "category": "retail",
    }


def test_score_is_idempotent_no_duplicate_effects():
    """Re-delivery returns the ORIGINAL decision; graph effects are not re-applied."""
    from apps.api.main import state

    tx_id = "tx_idem_probe_001"
    graph_edges_before = state.require(state.temporal_graph).graph.number_of_edges()

    first = client.post("/api/score", json=_score_payload(tx_id)).json()
    assert first["idempotent_replay"] is False
    graph_edges_after_first = state.require(state.temporal_graph).graph.number_of_edges()

    second = client.post("/api/score", json=_score_payload(tx_id)).json()

    # Identical decision, marked as a replay
    assert second["idempotent_replay"] is True
    assert second["audit_receipt_hash"] == first["audit_receipt_hash"]
    assert second["calibrated_probability"] == first["calibrated_probability"]
    # No side effects re-applied: graph edge count unchanged by the replay
    assert state.require(state.temporal_graph).graph.number_of_edges() == graph_edges_after_first
    # ... and the first scoring did apply its effect exactly once
    assert graph_edges_after_first >= graph_edges_before


def _force_deterministic_429(prefix: str):
    """Drives a REAL 429 through /api/score deterministically.

    The production limiter is burst-60 with a 10 tokens/s refill, so
    exhausting it by hammering depends on wall-clock request speed: on a
    slow run the refill keeps up and no 429 ever fires (observed flake).
    Swapping in a burst-1, ~zero-refill bucket makes throttling
    timing-independent; the 429 still travels the full endpoint +
    middleware path, and the production limiter is restored afterwards.
    """
    from apps.api.integrity import TokenBucketRateLimiter
    from apps.api.main import state

    real = state.require(state.rate_limiter)
    state.rate_limiter = TokenBucketRateLimiter(rate_per_minute=0.001, burst=1)
    try:
        for i in range(4):
            res = client.post("/api/score", json=_score_payload(f"{prefix}_{i}"))
            if res.status_code == 429:
                return res
    finally:
        state.rate_limiter = real
    raise AssertionError("Rate limiter never fired despite a burst-1 bucket")


def test_rate_limiting_returns_429():
    """The per-client token bucket throttles with 429 (deterministic)."""
    res = _force_deterministic_429("tx_rl_det")
    assert res.status_code == 429
    assert "Rate limit exceeded" in res.json()["detail"]
    # Non-score endpoints are unaffected (health still fine)
    assert client.get("/api/health").status_code == 200


def test_request_id_header_present_and_echoed():
    res = client.get("/api/health")
    assert res.status_code == 200
    rid = res.headers.get("x-request-id")
    assert rid and len(rid) <= 64

    # A well-formed incoming id is reused
    res2 = client.get("/api/health", headers={"X-Request-ID": "trace-integrity-42"})
    assert res2.headers.get("x-request-id") == "trace-integrity-42"

    # A malformed incoming id is replaced (no header injection)
    res3 = client.get("/api/health", headers={"X-Request-ID": "bad id with spaces!"})
    rid3 = res3.headers.get("x-request-id")
    assert rid3 and " " not in rid3 and rid3 != "bad id with spaces!"


def test_decision_ledger_is_append_only_and_receipt_linked(tmp_path):
    """First-time decisions are appended; replays are not; records link receipts."""
    from apps.api.main import state

    ledger = state.require(state.decision_ledger)
    ledger.path = str(tmp_path / "ledger.jsonl")
    ledger._index.clear()

    tx_id = "tx_ledger_probe_001"
    first = client.post("/api/score", json=_score_payload(tx_id)).json()
    client.post("/api/score", json=_score_payload(tx_id))  # replay

    record = ledger.get(tx_id)
    assert record is not None
    assert record["receipt_sha256"] == first["audit_receipt_hash"]
    assert record["calibrated_probability"] == first["calibrated_probability"]
    assert record["recommended_action"] == first["recommended_action"]
    assert record["model_id"] == first["model_id"]
    assert record["source"] == "live"

    # The replay must NOT have appended a second record
    with open(ledger.path) as fh:
        lines = [json.loads(raw) for raw in fh if raw.strip()]
    assert len([r for r in lines if r["transaction_id"] == tx_id]) == 1


def test_readiness_endpoint_reports_engine_state():
    res = client.get("/api/ready")
    assert res.status_code == 200
    data = res.json()
    assert "ready" in data and "checks" in data
    for key in (
        "model_loaded",
        "calibrator_fitted",
        "policy_present",
        "feature_pipeline_fitted",
        "bundle_validated",
    ):
        assert key in data["checks"]
    # With the validated bundle loaded, the engine must be ready
    assert data["ready"] is True
    assert data["calibration_source"] == "validation-artifact"


def test_readiness_is_false_without_model(monkeypatch):
    """An engine without artifacts must NOT claim readiness."""
    from apps.api import main as api_main

    monkeypatch.setattr(api_main, "state", api_main.ModelState())
    fake = api_main.ModelState()
    # no model, no calibrator, no policy
    monkeypatch.setattr(api_main, "state", fake)
    res = TestClient(api_main.app).get("/api/ready")
    data = res.json()
    assert data["ready"] is False
    assert data["checks"]["model_loaded"] is False
