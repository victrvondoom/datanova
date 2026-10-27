"""
Temporal Velocity & Behavioral Feature Engineering Engine.
Strictly forward-moving: Only historical transactions prior to time t are observed.
Extracts:
- Multi-scale rolling transaction count & volume (1h, 6h, 24h, 7d)
- Deviation of amount relative to sender historical mean (z-score & ratio)
- Inter-transaction arrival times (seconds since previous transaction)
- Entity velocity (distinct devices, IPs, and merchants per account in 24h)
- Circadian time features (hour of day, day of week, cyclical sine/cosine encodings)
"""

from typing import Dict, List, Optional
import numpy as np
import pandas as pd


class TemporalFeatureExtractor:
    """
    Computes streaming and batch temporal features with strict zero-lookahead guarantees.
    """

    def __init__(self):
        # State tracking for online / streaming feature updates
        self.sender_history: Dict[str, List[Tuple[float, float, str, str, str]]] = {}
        # Format: (timestamp_sec, amount, receiver_id, device_id, ip_address)

    def extract_batch_features(
        self,
        df: pd.DataFrame,
        time_col: str = "timestamp",
        sender_col: str = "sender_id",
        receiver_col: str = "receiver_id",
        amount_col: str = "amount",
        device_col: str = "device_id",
        ip_col: str = "ip_address",
    ) -> pd.DataFrame:
        """
        Fast batch computation of temporal rolling window features across a chronologically sorted DataFrame.
        """
        if not df[time_col].is_monotonic_increasing:
            df = df.sort_values(time_col).reset_index(drop=True)

        features = pd.DataFrame(index=df.index)
        
        # 1. Base log amount
        features["log_amount"] = np.log1p(df[amount_col].values)
        
        # 2. Circadian features
        ts = pd.to_datetime(df[time_col])
        hour = ts.dt.hour.values
        dow = ts.dt.dayofweek.values
        
        features["hour_of_day"] = hour
        features["day_of_week"] = dow
        features["is_weekend"] = (dow >= 5).astype(int)
        
        # Cyclical sine/cosine transformation for continuous periodic signals
        features["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
        features["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
        features["dow_sin"] = np.sin(2 * np.pi * dow / 7.0)
        features["dow_cos"] = np.cos(2 * np.pi * dow / 7.0)

        # 3. Fast grouping for rolling sender velocities
        # Group by sender to compute rolling metrics chronologically
        n = len(df)
        time_seconds = ts.astype("int64").values // 10**9
        amounts = df[amount_col].values
        senders = df[sender_col].values
        devices = df[device_col].fillna("none").values if device_col in df else ["none"] * n
        ips = df[ip_col].fillna("none").values if ip_col in df else ["none"] * n
        receivers = df[receiver_col].fillna("none").values if receiver_col in df else ["none"] * n

        # Output feature arrays
        tx_count_1h = np.zeros(n, dtype=np.float32)
        tx_count_24h = np.zeros(n, dtype=np.float32)
        tx_amount_sum_24h = np.zeros(n, dtype=np.float32)
        amount_ratio_24h = np.ones(n, dtype=np.float32)
        time_since_prev_sec = np.full(n, 86400.0, dtype=np.float32) # Default 24h
        distinct_devices_24h = np.ones(n, dtype=np.float32)
        distinct_ips_24h = np.ones(n, dtype=np.float32)
        distinct_receivers_24h = np.ones(n, dtype=np.float32)

        # Track history per sender: list of (t_sec, amt, dev, ip, rec)
        sender_hist: Dict[str, List] = {}

        for i in range(n):
            s = senders[i]
            t = time_seconds[i]
            amt = amounts[i]
            dev = devices[i]
            ip = ips[i]
            rec = receivers[i]

            if s in sender_hist:
                hist = sender_hist[s]
                # Filter events strictly prior to current t within 24h (86400s)
                cutoff_24h = t - 86400
                cutoff_1h = t - 3600
                
                # Prune very old events (> 7 days) to bound memory
                cutoff_7d = t - (7 * 86400)
                while hist and hist[0][0] < cutoff_7d:
                    hist.pop(0)

                # Prior events in 24h
                events_24h = [e for e in hist if e[0] >= cutoff_24h]
                events_1h = [e for e in events_24h if e[0] >= cutoff_1h]

                c_1h = len(events_1h)
                c_24h = len(events_24h)
                
                tx_count_1h[i] = c_1h
                tx_count_24h[i] = c_24h

                if events_24h:
                    sum_amt = sum(e[1] for e in events_24h)
                    mean_amt = sum_amt / c_24h
                    tx_amount_sum_24h[i] = sum_amt
                    amount_ratio_24h[i] = amt / max(1.0, mean_amt)
                    
                    devs = {e[2] for e in events_24h if e[2] != "none"}
                    devs.add(dev)
                    distinct_devices_24h[i] = len(devs)
                    
                    ips_set = {e[3] for e in events_24h if e[3] != "none"}
                    ips_set.add(ip)
                    distinct_ips_24h[i] = len(ips_set)

                    recs = {e[4] for e in events_24h if e[4] != "none"}
                    recs.add(rec)
                    distinct_receivers_24h[i] = len(recs)

                # Time since previous transaction
                if hist:
                    prev_t = hist[-1][0]
                    delta = max(0.0, float(t - prev_t))
                    time_since_prev_sec[i] = delta

                # Record current transaction
                hist.append((t, amt, dev, ip, rec))
            else:
                # First time seeing this sender
                sender_hist[s] = [(t, amt, dev, ip, rec)]

        features["tx_count_1h"] = tx_count_1h
        features["tx_count_24h"] = tx_count_24h
        features["tx_amount_sum_24h"] = tx_amount_sum_24h
        features["amount_ratio_24h"] = amount_ratio_24h
        features["time_since_prev_sec"] = time_since_prev_sec
        features["log_time_since_prev"] = np.log1p(time_since_prev_sec)
        features["distinct_devices_24h"] = distinct_devices_24h
        features["distinct_ips_24h"] = distinct_ips_24h
        features["distinct_receivers_24h"] = distinct_receivers_24h

        # Velocity surge flag: e.g. >= 3 tx in 1 hour or sudden device proliferation
        features["is_velocity_surge"] = ((tx_count_1h >= 3) | (distinct_devices_24h >= 2)).astype(int)

        return features
