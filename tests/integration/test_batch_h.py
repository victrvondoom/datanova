"""Integration tests for Milestone 3 batch H (catalog: inv_decision_replay).

Decision replay must reproduce archived decisions exactly through the shared
prediction core, with honest drift verdicts and ZERO side effects.
"""

import os
import sys
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from apps.api import main as api_main
from apps.api.main import app, startup_event
from packages.data.schemas import DecisionPolicy

client = TestClient(app)
startup_event()


@pytest.fixture(autouse=True)
def _isolated_state(monkeypatch):
    monkeypatch.delenv("AEGIS_API_KEY", raising=False)
    monkeypatch.delenv("AEGIS_ADMIN_API_KEY", raising=False)
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()
    api_main.state.emergency_stop_engaged = False
    yield
    api_main.state.require(api_main.state.rate_limiter)._buckets.clear()
    api_main.state.emergency_stop_engaged = False


def _payload(tx_id: str) -> dict:
    return {
        "transaction_id": tx_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender_id": "usr_replay_h",
        "receiver_id": "merch_replay_h",
        "amount": 340.0,
        "currency": "USD",
        "channel": "web",
        "device_id": "dev_replay_h",
        "category": "travel",
    }


def _score(tx_id: str) -> dict:
    res = client.post("/api/score", json=_payload(tx_id))
    assert res.status_code == 200, res.text
    return res.json()


def _graph_size():
    g = api_main.state.require(api_main.state.temporal_graph).graph
    return (g.number_of_nodes(), g.number_of_edges())


def test_replay_reproduces_archived_decision_exactly():
    """Same input, unchanged state -> identical probability and action."""
    scored = _score("tx_replay_ok_1")
    before = _graph_size()
    ledger_len = len(api_main.state.require(api_main.state.decision_ledger))

    res = client.post("/api/decisions/tx_replay_ok_1/replay", json=_payload("tx_replay_ok_1"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["verdict"] == "reproduced"
    assert body["checks"]["probability_matches"] is True
    assert body["checks"]["action_matches"] is True
    assert body["archived"]["calibrated_probability"] == scored["calibrated_probability"]
    assert body["replayed"]["calibrated_probability"] == scored["calibrated_probability"]
    assert body["replayed"]["recommended_action"] == scored["recommended_action"]
    assert body["archived"]["receipt_sha256"] == scored["audit_receipt_hash"]
    # zero side effects: graph, ledger untouched
    assert _graph_size() == before
    assert len(api_main.state.require(api_main.state.decision_ledger)) == ledger_len


def test_replay_returns_404_without_archived_decision():
    res = client.post("/api/decisions/tx_never_scored/replay", json=_payload("tx_never_scored"))
    assert res.status_code == 404


def test_replay_rejects_mismatched_payload_id():
    _score("tx_replay_id_1")
    res = client.post("/api/decisions/tx_replay_id_1/replay", json=_payload("tx_other_id_9"))
    assert res.status_code == 422
    assert "does not match" in res.json()["detail"]


def test_replay_reports_action_drift_under_emergency_stop():
    """Emergency stop changes the action, not the probability -> action_drift."""
    _score("tx_replay_estop_1")
    api_main.state.emergency_stop_engaged = True
    res = client.post("/api/decisions/tx_replay_estop_1/replay", json=_payload("tx_replay_estop_1"))
    body = res.json()
    assert body["verdict"] == "action_drift"
    assert body["checks"]["probability_matches"] is True
    assert body["checks"]["action_matches"] is False
    assert body["replayed"]["recommended_action"] == "REVIEW"
    assert any("Emergency stop" in n for n in body["notes"])


def test_replay_reports_policy_drift():
    """A changed policy name is reported honestly, not as reproduction."""
    _score("tx_replay_pol_1")
    original = api_main.state.current_policy
    api_main.state.current_policy = DecisionPolicy(policy_name="Dispute-Test-Policy")
    try:
        res = client.post("/api/decisions/tx_replay_pol_1/replay", json=_payload("tx_replay_pol_1"))
        body = res.json()
        assert res.status_code == 200
        assert body["verdict"] == "policy_drift"
        assert body["checks"]["policy_matches"] is False
    finally:
        api_main.state.current_policy = original


def test_replay_reports_probability_drift_against_altered_archive():
    """If the archived probability no longer matches the input, replay says so.

    The archive record is altered deterministically (simulating a disputed
    record) so the drift branch is exercised without depending on
    incidental graph-state evolution.
    """
    _score("tx_replay_drift_1")
    ledger = api_main.state.require(api_main.state.decision_ledger)
    ledger.get("tx_replay_drift_1")["calibrated_probability"] = 0.9999
    res = client.post("/api/decisions/tx_replay_drift_1/replay", json=_payload("tx_replay_drift_1"))
    body = res.json()
    assert body["verdict"] == "probability_drift"
    assert body["checks"]["probability_matches"] is False
    assert body["archived"]["calibrated_probability"] == 0.9999
