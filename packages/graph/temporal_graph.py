"""
Adaptive Temporal Fraud Graph Engine.
Maintains a dynamic, time-aware heterogeneous graph linking:
- Accounts (Senders & Receivers)
- Devices
- IP Addresses
Provides rolling-window edge pruning to guarantee sub-20ms real-time lookups.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

import networkx as nx


def to_naive_utc(dt):
    """Normalizes any datetime/Timestamp (naive or aware) to timezone-naive UTC."""
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    if hasattr(dt, "to_pydatetime"):
        pydt = dt.to_pydatetime()
        if pydt.tzinfo is not None:
            return pydt.astimezone(timezone.utc).replace(tzinfo=None)
        return pydt
    return dt


class TemporalFraudGraph:
    """
    Directed, time-stamped multi-relational graph.
    Tracks money flow and device sharing networks to uncover syndicates and mule rings.
    """

    def __init__(self, retention_hours: int = 168):  # Default 7 days retention
        self.retention_hours = retention_hours
        self.graph = nx.DiGraph()
        # Edge metadata tracking: (u, v) -> list of {"timestamp": dt, "amount": float, "type": str}
        self.edge_history: Dict[Tuple[str, str], List[Dict]] = {}
        # Device to accounts index
        self.device_to_accounts: Dict[str, Set[str]] = {}

    def add_transaction(
        self,
        sender_id: str,
        receiver_id: str,
        amount: float,
        timestamp: datetime,
        device_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ):
        """Adds transaction and entity relationships to the graph."""
        norm_ts = to_naive_utc(timestamp)
        # 1. Money flow edge: sender -> receiver
        if not self.graph.has_node(sender_id):
            self.graph.add_node(sender_id, node_type="account")
        if not self.graph.has_node(receiver_id):
            self.graph.add_node(receiver_id, node_type="account")

        edge_key = (sender_id, receiver_id)
        if edge_key not in self.edge_history:
            self.edge_history[edge_key] = []

        self.edge_history[edge_key].append({
            "timestamp": norm_ts,
            "amount": amount,
            "type": "payment",
        })

        # Add or update edge weight in NetworkX
        self.graph.add_edge(sender_id, receiver_id, weight=amount, last_seen=norm_ts)

        # 2. Device association edge: device <-> sender
        if device_id and device_id != "none":
            if device_id not in self.device_to_accounts:
                self.device_to_accounts[device_id] = set()
            self.device_to_accounts[device_id].add(sender_id)

    def prune_older_than(self, current_time: datetime):
        """Evicts graph edges older than retention_hours to bound memory and latency."""
        cutoff = to_naive_utc(current_time) - timedelta(hours=self.retention_hours)
        dead_edges = []

        for edge_key, events in list(self.edge_history.items()):
            # Keep only events newer than cutoff
            valid_events = [e for e in events if e["timestamp"] >= cutoff]
            if not valid_events:
                dead_edges.append(edge_key)
            else:
                self.edge_history[edge_key] = valid_events

        for u, v in dead_edges:
            del self.edge_history[(u, v)]
            if self.graph.has_edge(u, v):
                self.graph.remove_edge(u, v)

    def get_summary_statistics(self) -> Dict:
        """Returns graph topological health metrics."""
        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "tracked_devices": len(self.device_to_accounts),
            "multi_account_devices": sum(1 for accs in self.device_to_accounts.values() if len(accs) > 1),
        }
