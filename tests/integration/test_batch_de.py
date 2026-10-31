"""Integration tests for Milestone 3 batches D (API-key auth) and E (cases).

Catalog features covered:
- authn_apikeys: env-gated API-key authentication with honest mode reporting
- case_intake / case_data_model / case_evidence_linking / case_lifecycle_states
  / case_notes / case_api_surface: the case-management vertical slice
"""

import os
import sys
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from apps.api import main as api_main
from apps.api.main import app, startup_event

client = TestClient(app)
startup_event()


@pytest.fixture(autouse=True)
def _isolated_state(monkeypatch):
    """Local mode (no key) + clean rate limiter for every test."""
    monkeypatch.delenv("AEGIS_API_KEY", raising=False)
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()
    api_main.state.emergency_stop_engaged = False
    yield
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()


def _score_once(tx_id: str) -> dict:
    res = client.post(
        "/api/score",
        json={
            "transaction_id": tx_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sender_id": "usr_batchde_01",
            "receiver_id": "merch_batchde_01",
            "amount": 250.0,
            "currency": "USD",
            "channel": "mobile",
            "device_id": "dev_batchde",
            "category": "retail",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


# ------------------------------------------------------------------ auth

def test_local_mode_is_open_and_reported():
    """Without AEGIS_API_KEY the API is open and health says so honestly."""
    health = client.get("/api/health").json()
    assert health["auth_mode"] == "local-open"
    assert _score_once("tx_auth_local_001")["model_id"]


def test_api_key_mode_requires_matching_key(monkeypatch):
    """With AEGIS_API_KEY set, protected endpoints demand the key."""
    monkeypatch.setenv("AEGIS_API_KEY", "test-secret-key-123")

    # Health/readiness stay open for orchestrators
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/ready").status_code == 200
    assert client.get("/api/health").json()["auth_mode"] == "api-key"

    payload = {
        "transaction_id": "tx_auth_protected_001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "u",
        "receiver_id": "m",
        "amount": 20.0,
        "channel": "web",
    }
    # Missing key -> 401
    assert client.post("/api/score", json=payload).status_code == 401
    # Wrong key -> 401
    assert client.post("/api/score", json=payload, headers={"X-API-Key": "wrong"}).status_code == 401
    # Correct key -> 200
    ok = client.post("/api/score", json=payload, headers={"X-API-Key": "test-secret-key-123"})
    assert ok.status_code == 200
    # Read-only listing endpoints are also protected
    assert client.get("/api/decisions").status_code == 401
    assert client.get("/api/decisions", headers={"X-API-Key": "test-secret-key-123"}).status_code == 200


# ------------------------------------------------------------------ cases

def test_case_lifecycle_full_journey():
    """Intake -> notes -> IN_PROGRESS -> revert -> IN_PROGRESS -> CLOSED with outcome."""
    scored = _score_once("tx_case_journey_001")

    # Intake links evidence by reference to the archived decision
    created = client.post("/api/cases", json={"transaction_id": "tx_case_journey_001"})
    assert created.status_code == 200
    case = created.json()
    assert case["case_id"].startswith("case_")
    assert case["status"] == "OPEN"
    assert case["receipt_sha256"] == scored["audit_receipt_hash"]
    assert case["model_id"] == scored["model_id"]
    assert case["artifact_run_id"] is not None

    case_id = case["case_id"]

    # Investigator note
    noted = client.post(
        f"/api/cases/{case_id}/notes",
        json={"author": "analyst_a", "text": "Called the customer; card was present."},
    )
    assert noted.status_code == 200
    assert len(noted.json()["notes"]) == 1
    assert noted.json()["notes"][0]["author"] == "analyst_a"

    # OPEN -> IN_PROGRESS
    prog = client.post(f"/api/cases/{case_id}/transition", json={"status": "in_progress"})
    assert prog.status_code == 200
    assert prog.json()["status"] == "IN_PROGRESS"

    # IN_PROGRESS -> OPEN (revert allowed)
    rev = client.post(f"/api/cases/{case_id}/transition", json={"status": "OPEN"})
    assert rev.status_code == 200

    # Illegal transition: OPEN -> CLOSED directly is forbidden
    illegal = client.post(f"/api/cases/{case_id}/transition", json={"status": "CLOSED", "outcome": "x"})
    assert illegal.status_code == 422

    # Close without outcome is rejected
    client.post(f"/api/cases/{case_id}/transition", json={"status": "IN_PROGRESS"})
    no_outcome = client.post(f"/api/cases/{case_id}/transition", json={"status": "CLOSED"})
    assert no_outcome.status_code == 422

    # Close with outcome succeeds
    closed = client.post(
        f"/api/cases/{case_id}/transition",
        json={"status": "CLOSED", "outcome": "confirmed_fraud"},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "CLOSED"
    assert closed.json()["outcome"] == "confirmed_fraud"


def test_case_intake_requires_archived_decision():
    """Cases cannot exist without linked evidence."""
    res = client.post("/api/cases", json={"transaction_id": "never_scored_case_probe"})
    assert res.status_code == 404
    assert "score the transaction first" in res.json()["detail"]


def test_case_listing_and_filters():
    _score_once("tx_case_list_001")
    _score_once("tx_case_list_002")
    c1 = client.post("/api/cases", json={"transaction_id": "tx_case_list_001"}).json()
    c2 = client.post("/api/cases", json={"transaction_id": "tx_case_list_002"}).json()
    client.post(f"/api/cases/{c2['case_id']}/transition", json={"status": "IN_PROGRESS"})

    listing = client.get("/api/cases").json()
    ids = [r["case_id"] for r in listing["records"]]
    assert c1["case_id"] in ids and c2["case_id"] in ids

    open_only = client.get("/api/cases?status=OPEN").json()
    assert all(r["status"] == "OPEN" for r in open_only["records"])
    assert c2["case_id"] not in [r["case_id"] for r in open_only["records"]]

    assert client.get("/api/cases?status=BOGUS").status_code == 422
    assert client.get("/api/cases/case_missing_999").status_code == 404


def test_case_evidence_integrity():
    """The case's linked evidence matches the immutable archived decision."""
    scored = _score_once("tx_case_evidence_001")
    case = client.post("/api/cases", json={"transaction_id": "tx_case_evidence_001"}).json()
    archived = client.get("/api/decisions/tx_case_evidence_001").json()

    assert case["receipt_sha256"] == archived["receipt_sha256"] == scored["audit_receipt_hash"]
    assert case["calibrated_probability"] == archived["calibrated_probability"]
    assert case["recommended_action"] == archived["recommended_action"]
    # The case carries NO transaction payload (minimization by reference)
    assert "sender_id" not in case and "amount" not in case
