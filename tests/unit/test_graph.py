"""Unit tests for temporal graph and cycle detection."""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime, timedelta
from packages.graph.temporal_graph import TemporalFraudGraph
from packages.graph.features import GraphFeatureExtractor


def test_temporal_graph_and_cycle_detection():
    graph = TemporalFraudGraph(retention_hours=24)
    now = datetime(2026, 1, 1, 10, 0, 0)

    # Establish flow: A -> B -> C
    graph.add_transaction("A", "B", 1000.0, now)
    graph.add_transaction("B", "C", 1000.0, now + timedelta(minutes=5))

    extractor = GraphFeatureExtractor(window_hours=24)

    # Now transaction C -> A closes a 3-hop directed cycle (smurfing ring!)
    feats = extractor.extract_features_for_transaction(
        graph=graph,
        sender_id="C",
        receiver_id="A",
        timestamp=now + timedelta(minutes=10),
    )

    assert feats["graph_cycle_detected"] == 1.0


def test_device_sharing_detection():
    graph = TemporalFraudGraph(retention_hours=24)
    now = datetime(2026, 1, 1, 10, 0, 0)

    # Device dev_shared used by account_1 and account_2
    graph.add_transaction("acc_1", "merch_1", 100.0, now, device_id="dev_shared")
    graph.add_transaction("acc_2", "merch_2", 100.0, now, device_id="dev_shared")

    extractor = GraphFeatureExtractor(window_hours=24)
    feats = extractor.extract_features_for_transaction(
        graph=graph,
        sender_id="acc_3",
        receiver_id="merch_3",
        timestamp=now + timedelta(minutes=1),
        device_id="dev_shared",
    )
    # dev_shared was seen with 2 prior accounts
    assert feats["graph_device_shared_accounts"] >= 2.0
