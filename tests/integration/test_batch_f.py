"""Integration tests for Milestone 3 batch F.

Catalog features covered:
- api_input_size_limits: 413 on oversized bodies, env-tunable, disable-able
- authz_admin_surface: admin privilege tier for state-mutating endpoints
- case_outcomes: typed outcome vocabulary, validated close, aggregated summary
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
    """Local-open mode + clean rate limiter for every test."""
    monkeypatch.delenv("AEGIS_API_KEY", raising=False)
    monkeypatch.delenv("AEGIS_ADMIN_API_KEY", raising=False)
    monkeypatch.delenv("AEGIS_MAX_BODY_BYTES", raising=False)
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()
    api_main.state.emergency_stop_engaged = False
    yield
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()
    api_main.state.emergency_stop_engaged = False


def _tx_payload(tx_id: str, pad: int = 0) -> dict:
    return {
        "transaction_id": tx_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_batch_f",
        "receiver_id": "merch_batch_f",
        "amount": 120.0,
        "currency": "USD",
        "channel": "web",
        "device_id": "dev_batch_f" + ("x" * pad),
        "category": "retail",
    }


def _score_once(tx_id: str) -> dict:
    res = client.post("/api/score", json=_tx_payload(tx_id))
    assert res.status_code == 200, res.text
    return res.json()


def _open_case(tx_id: str) -> str:
    res = client.post("/api/cases", json={"transaction_id": tx_id})
    assert res.status_code == 200, res.text
    return res.json()["case_id"]


# ---------------------------------------------------- api_input_size_limits

def test_size_limit_rejects_oversized_bodies(monkeypatch):
    """Bodies above AEGIS_MAX_BODY_BYTES get 413 without being processed."""
    monkeypatch.setenv("AEGIS_MAX_BODY_BYTES", "1000")
    assert client.post("/api/score", json=_tx_payload("tx_size_ok_1")).status_code == 200
    oversized = client.post("/api/score", json=_tx_payload("tx_size_big_1", pad=5000))
    assert oversized.status_code == 413
    assert "exceeds the limit" in oversized.json()["detail"]


def test_size_limit_default_allows_normal_bodies(monkeypatch):
    """Without the env var, the 1 MiB default never blocks real transactions."""
    monkeypatch.delenv("AEGIS_MAX_BODY_BYTES", raising=False)
    assert client.post("/api/score", json=_tx_payload("tx_size_default_1", pad=20000)).status_code == 200


def test_size_limit_zero_disables_check(monkeypatch):
    """A limit <= 0 disables the guard (trusted bulk-import tooling)."""
    monkeypatch.setenv("AEGIS_MAX_BODY_BYTES", "0")
    assert client.post("/api/score", json=_tx_payload("tx_size_off_1", pad=50000)).status_code == 200


def test_size_limit_rejection_needs_no_credentials(monkeypatch):
    """The 413 fires in api-key mode even without a valid key (middleware
    order: bounded input is rejected before auth or processing)."""
    monkeypatch.setenv("AEGIS_API_KEY", "test-secret-key-123")
    monkeypatch.setenv("AEGIS_MAX_BODY_BYTES", "1000")
    res = client.post("/api/score", json=_tx_payload("tx_size_auth_1", pad=5000))
    assert res.status_code == 413


# ---------------------------------------------------- authz_admin_surface

def test_admin_endpoints_open_in_local_mode():
    """Local-open deployment: admin endpoints usable, honestly reported."""
    assert client.get("/api/health").json()["admin_auth_mode"] == "local-open"
    res = client.post("/api/admin/emergency-stop", json={"engaged": True})
    assert res.status_code == 200
    assert res.json()["engaged"] is True


def test_admin_endpoints_require_single_api_key(monkeypatch):
    """With only AEGIS_API_KEY set, admin inherits that key."""
    monkeypatch.setenv("AEGIS_API_KEY", "test-secret-key-123")
    assert client.get("/api/health").json()["admin_auth_mode"] == "api-key"
    assert client.post("/api/admin/emergency-stop", json={"engaged": True}).status_code == 401
    res = client.post(
        "/api/admin/emergency-stop",
        json={"engaged": False},
        headers={"X-API-Key": "test-secret-key-123"},
    )
    assert res.status_code == 200
    # optimize-policy is guarded the same way (401 proves the dependency fires)
    assert (
        client.post("/api/optimize-policy", json={}).status_code == 401
    )


def test_admin_key_separates_privileges(monkeypatch):
    """AEGIS_ADMIN_API_KEY grants admin; the ordinary API key does NOT."""
    monkeypatch.setenv("AEGIS_API_KEY", "ordinary-key-456")
    monkeypatch.setenv("AEGIS_ADMIN_API_KEY", "admin-key-789")
    assert client.get("/api/health").json()["admin_auth_mode"] == "admin-key"

    # Ordinary key works on ordinary endpoints...
    scored = client.post(
        "/api/score", json=_tx_payload("tx_admin_sep_1"), headers={"X-API-Key": "ordinary-key-456"}
    )
    assert scored.status_code == 200
    # ...but is refused on admin endpoints.
    wrong = client.post(
        "/api/admin/emergency-stop",
        json={"engaged": True},
        headers={"X-API-Key": "ordinary-key-456"},
    )
    assert wrong.status_code == 401
    missing = client.post("/api/admin/emergency-stop", json={"engaged": True})
    assert missing.status_code == 401
    ok = client.post(
        "/api/admin/emergency-stop",
        json={"engaged": False},
        headers={"X-API-Key": "admin-key-789"},
    )
    assert ok.status_code == 200
    # optimize-policy also refuses the ordinary key
    assert (
        client.post(
            "/api/optimize-policy", json={}, headers={"X-API-Key": "ordinary-key-456"}
        ).status_code
        == 401
    )


# ---------------------------------------------------- case_outcomes

def test_outcome_vocabulary_endpoint():
    """The closed outcome vocabulary is exposed and documented."""
    res = client.get("/api/cases/outcome-codes")
    assert res.status_code == 200
    codes = {c["code"] for c in res.json()["codes"]}
    assert codes == {
        "confirmed_fraud",
        "recovered_fraud",
        "false_positive",
        "partially_confirmed",
        "inconclusive",
        "abandoned",
    }
    assert all(c["description"] for c in res.json()["codes"])


def test_close_requires_known_outcome_code():
    """Free-text outcomes are rejected; only vocabulary codes are accepted."""
    _score_once("tx_outcome_vocab_1")
    case_id = _open_case("tx_outcome_vocab_1")
    assert (
        client.post(
            f"/api/cases/{case_id}/transition", json={"status": "IN_PROGRESS"}
        ).status_code
        == 200
    )
    bad = client.post(
        f"/api/cases/{case_id}/transition",
        json={"status": "CLOSED", "outcome": "it-was-fine-trust-me"},
    )
    assert bad.status_code == 422
    assert "confirmed_fraud" in bad.json()["detail"]  # valid codes listed
    good = client.post(
        f"/api/cases/{case_id}/transition",
        json={
            "status": "CLOSED",
            "outcome": "confirmed_fraud",
            "outcome_detail": "Card-not-present fraud confirmed with issuer.",
            "closed_by": "investigator_a",
        },
    )
    assert good.status_code == 200, good.text
    body = good.json()
    assert body["outcome"] == "confirmed_fraud"
    assert body["outcome_detail"].startswith("Card-not-present")
    assert body["closed_by"] == "investigator_a"
    assert body["outcome_recorded_at"] is not None
    assert body["status"] == "CLOSED"


def test_outcome_summary_counts_only_closed_cases():
    """The summary aggregates typed outcomes; open cases stay uncounted."""
    before = client.get("/api/cases/outcomes/summary").json()

    _score_once("tx_outcome_sum_1")
    _score_once("tx_outcome_sum_2")
    for tx, code in (("tx_outcome_sum_1", "false_positive"), ("tx_outcome_sum_2", "inconclusive")):
        case_id = _open_case(tx)
        for step in ("IN_PROGRESS", "CLOSED"):
            res = client.post(
                f"/api/cases/{case_id}/transition",
                json={"status": step, "outcome": code if step == "CLOSED" else None},
            )
            assert res.status_code == 200, res.text

    after = client.get("/api/cases/outcomes/summary").json()
    assert after["closed_cases"] == before["closed_cases"] + 2
    assert after["by_outcome"]["false_positive"] == before["by_outcome"]["false_positive"] + 1
    assert after["by_outcome"]["inconclusive"] == before["by_outcome"]["inconclusive"] + 1
    # unresolved remainder is reported, not hidden
    assert after["total_cases"] >= after["closed_cases"]
    assert set(after["by_outcome"]) == {
        "confirmed_fraud",
        "recovered_fraud",
        "false_positive",
        "partially_confirmed",
        "inconclusive",
        "abandoned",
    }
