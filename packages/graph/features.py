"""
Graph Feature Extractor for Syndicate and Mule Ring Detection.
Computes local topological indicators at transaction time:
- In/Out degree within rolling window
- Device-sharing multiplicity (syndicate indicator)
- Multi-hop cycle detection (smurfing & circular laundering chains)
- Receiver fan-in concentration
"""

from datetime import datetime, timedelta
from typing import Dict, Optional

import networkx as nx
import pandas as pd

from packages.graph.temporal_graph import TemporalFraudGraph, to_naive_utc


class GraphFeatureExtractor:
    """Extracts graph topological features for transactions without future leakage."""

    def __init__(self, window_hours: int = 24):
        self.window_hours = window_hours

    def extract_features_for_transaction(
        self,
        graph: TemporalFraudGraph,
        sender_id: str,
        receiver_id: str,
        timestamp: datetime,
        device_id: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        Calculates graph features for a single candidate transaction relative to graph state up to timestamp.
        """
        norm_ts = to_naive_utc(timestamp)
        cutoff = norm_ts - timedelta(hours=self.window_hours)
        G = graph.graph

        feats: Dict[str, float] = {
            "graph_sender_out_degree": 0.0,
            "graph_receiver_in_degree": 0.0,
            "graph_device_shared_accounts": 1.0,
            "graph_cycle_detected": 0.0,
            "graph_is_reciprocal": 0.0,
            "graph_sender_pagerank": 0.0,
        }

        # Sender out-degree in 24h
        if G.has_node(sender_id):
            out_edges = G.out_edges(sender_id)
            c_out = 0
            for u, v in out_edges:
                events = graph.edge_history.get((u, v), [])
                c_out += sum(1 for e in events if e["timestamp"] >= cutoff)
            feats["graph_sender_out_degree"] = float(c_out)

        # Receiver in-degree in 24h
        if G.has_node(receiver_id):
            in_edges = G.in_edges(receiver_id)
            c_in = 0
            for u, v in in_edges:
                events = graph.edge_history.get((u, v), [])
                c_in += sum(1 for e in events if e["timestamp"] >= cutoff)
            feats["graph_receiver_in_degree"] = float(c_in)

        # Device sharing
        if device_id and device_id in graph.device_to_accounts:
            feats["graph_device_shared_accounts"] = float(len(graph.device_to_accounts[device_id]))

        # Cycle / Circular Flow Detection:
        # If receiver already has a directed path back to sender, adding sender -> receiver closes a loop
        if G.has_node(sender_id) and G.has_node(receiver_id):
            # Direct reciprocal flow
            if G.has_edge(receiver_id, sender_id):
                feats["graph_is_reciprocal"] = 1.0

            # 2-hop or 3-hop path from receiver back to sender
            try:
                if nx.has_path(G, receiver_id, sender_id):
                    # Check path length
                    path_len = nx.shortest_path_length(G, receiver_id, sender_id)
                    if 1 <= path_len <= 3:
                        feats["graph_cycle_detected"] = 1.0
            except nx.NetworkXError:
                pass

        return feats

    def extract_batch_graph_features(
        self,
        df: pd.DataFrame,
        time_col: str = "timestamp",
        sender_col: str = "sender_id",
        receiver_col: str = "receiver_id",
        amount_col: str = "amount",
        device_col: str = "device_id",
    ) -> pd.DataFrame:
        """
        Progressively populates graph and extracts graph features chronologically.
        Guarantees zero future leakage: transaction t only sees edges from < t.
        """
        if not df[time_col].is_monotonic_increasing:
            df = df.sort_values(time_col).reset_index(drop=True)

        graph = TemporalFraudGraph(retention_hours=self.window_hours * 3)
        records = []

        for _, row in df.iterrows():
            ts = row[time_col]
            s = str(row[sender_col])
            r = str(row[receiver_col])
            amt = float(row[amount_col])
            dev = str(row[device_col]) if device_col in row and pd.notna(row[device_col]) else None

            # 1. Extract features BEFORE adding current transaction (Strict Zero Lookahead)
            feats = self.extract_features_for_transaction(
                graph=graph,
                sender_id=s,
                receiver_id=r,
                timestamp=ts,
                device_id=dev,
            )
            records.append(feats)

            # 2. Add current transaction to graph for future transactions
            graph.add_transaction(
                sender_id=s,
                receiver_id=r,
                amount=amt,
                timestamp=ts,
                device_id=dev,
            )

        return pd.DataFrame(records, index=df.index)
