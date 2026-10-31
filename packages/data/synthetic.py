"""
Deterministic, High-Fidelity Synthetic Transaction Generator.
Models realistic financial characteristics:
- Log-normal amounts adhering to Benford's first-digit distribution
- Circadian time-of-day and day-of-week transaction velocity
- Legitimate consumer spending networks
- Fraud archetypes: Account Takeover (ATO), Mule Rings (smurfing cycles), and Velocity Blasts
"""

from datetime import datetime, timedelta
from typing import List, cast

import numpy as np
import pandas as pd

from packages.data.schemas import ChannelType, DatasetDesignation, Transaction


class SyntheticTransactionGenerator:
    """
    Generates realistic, seedable payment transaction streams with known ground-truth
    fraud archetypes for benchmarking and zero-lookahead evaluation.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def generate_stream(
        self,
        n_transactions: int = 10000,
        fraud_ratio: float = 0.02,
        start_time: datetime = datetime(2026, 1, 1, 0, 0, 0),
        n_legit_users: int = 500,
        n_merchants: int = 150,
        n_mule_rings: int = 5,
    ) -> pd.DataFrame:
        """
        Generates a chronological DataFrame of transactions.
        Guaranteed to be strictly sorted by timestamp.
        """
        self.rng = np.random.default_rng(self.seed)

        # 1. Establish user and merchant entity pools
        users = [f"usr_{i:04d}" for i in range(n_legit_users)]
        merchants = [f"merch_{i:03d}" for i in range(n_merchants)]
        devices = [f"dev_{i:04d}" for i in range(n_legit_users * 2)]
        ips = [
            f"192.168.{self.rng.integers(1, 255)}.{self.rng.integers(1, 255)}"
            for _ in range(n_legit_users * 2)
        ]

        # User home attributes
        user_profiles = {
            u: {
                "primary_device": devices[i % len(devices)],
                "primary_ip": ips[i % len(ips)],
                "mean_amount": float(np.exp(self.rng.normal(3.8, 0.75))),  # ~$45 - $300
                "std_amount": float(self.rng.uniform(15.0, 80.0)),
                "preferred_channel": str(
                    self.rng.choice(
                        ["mobile", "web", "pos", "p2p", "wire"], p=[0.55, 0.25, 0.14, 0.04, 0.02]
                    )
                ),
                "location": self.rng.choice(
                    ["US-NYC", "US-SFO", "US-CHI", "US-MIA", "US-SEA", "US-AUS"]
                ),
            }
            for i, u in enumerate(users)
        }

        # All categories are present in both legit and fraud with realistic priors
        all_categories = [
            "groceries",
            "retail",
            "utilities",
            "entertainment",
            "dining",
            "travel",
            "crypto_exchange",
            "money_transfer",
            "gaming",
            "wire_service",
        ]
        legit_cat_probs = [
            0.24,
            0.22,
            0.12,
            0.10,
            0.14,
            0.08,
            0.03,
            0.04,
            0.02,
            0.01,
        ]  # Legit users do buy crypto/gaming!
        fraud_cat_probs = [0.08, 0.14, 0.01, 0.05, 0.04, 0.18, 0.22, 0.16, 0.08, 0.04]

        # Calculate counts
        n_fraud = int(n_transactions * fraud_ratio)
        n_transactions - n_fraud

        # Timestamp generation with circadian rhythm over a 30-day window

        # Inter-arrival times in seconds (mean ~ 250s for 10k tx in 30 days)
        mean_interval = (30 * 86400) / n_transactions
        timestamps = []
        t = start_time
        for _ in range(n_transactions):
            hour = t.hour
            circadian = 0.3 + 0.7 * np.sin(np.pi * (hour - 3) / 21) ** 2
            interval = self.rng.exponential(mean_interval / max(0.1, circadian))
            t += timedelta(seconds=float(interval))
            timestamps.append(t)

        timestamps.sort()

        # Fraud Archetype 1: Mule Rings (Smurfing / Circular flows)
        mule_accounts = [f"mule_{i:03d}" for i in range(n_mule_rings * 4)]
        ring_members = [mule_accounts[i * 4 : (i + 1) * 4] for i in range(n_mule_rings)]

        # Generate base transactions
        legit_records = []
        for i in range(n_transactions):
            ts = timestamps[i]
            sender = self.rng.choice(users)
            profile = user_profiles[sender]
            receiver = self.rng.choice(merchants)

            # Amount: Log-normal distribution centered around user profile mean with natural variance
            mean_amt = cast(float, profile["mean_amount"])
            amount = max(2.50, float(self.rng.lognormal(np.log(mean_amt), 0.65)))
            amount = round(amount, 2)

            # 12% chance of guest device or roaming IP for normal users
            if self.rng.random() < 0.12:
                dev = f"dev_guest_{self.rng.integers(100, 999)}"
                ip = f"10.0.{self.rng.integers(1, 255)}.{self.rng.integers(1, 255)}"
            else:
                dev = str(profile["primary_device"])
                ip = str(profile["primary_ip"])

            ch_pref = str(profile["preferred_channel"])
            channel_val = ch_pref.value if hasattr(ch_pref, "value") else str(ch_pref).lower()
            cat = self.rng.choice(all_categories, p=legit_cat_probs)

            legit_records.append(
                {
                    "transaction_id": f"tx_{i:07d}",
                    "timestamp": ts,
                    "sender_id": sender,
                    "receiver_id": receiver,
                    "amount": amount,
                    "currency": "USD",
                    "channel": channel_val,
                    "device_id": dev,
                    "ip_address": ip,
                    "location": profile["location"],
                    "category": cat,
                    "is_fraud": 0,
                    "fraud_archetype": "none",
                    "dataset_designation": DatasetDesignation.SYNTHETIC.value,
                }
            )

        # Inject fraud bursts into legitimate records
        # Archetype A: Account Takeover (ATO) -> 40% of fraud
        n_ato = int(n_fraud * 0.40)
        # Archetype B: Mule Ring Cycles (Smurfing) -> 35% of fraud
        n_mule = int(n_fraud * 0.35)
        # Archetype C: Rapid Velocity Blast (CNP) -> 25% of fraud
        n_velocity = n_fraud - (n_ato + n_mule)

        # Inject ATO
        ato_victims = self.rng.choice(users, size=max(1, n_ato // 3), replace=False)
        target_slots = self.rng.choice(
            range(int(n_transactions * 0.1), n_transactions), size=n_ato, replace=False
        )
        for idx in target_slots:
            victim = self.rng.choice(ato_victims)
            rec = legit_records[idx]
            rec["is_fraud"] = 1
            rec["sender_id"] = victim
            rec["receiver_id"] = self.rng.choice(merchants)
            # Moderately elevated amount (2x - 4x mean)
            v_mean = cast(float, user_profiles[victim]["mean_amount"])
            rec["amount"] = round(
                float(v_mean * self.rng.uniform(2.2, 4.5) + self.rng.uniform(40, 250)), 2
            )
            # Attacker device: can be guest device or new ID
            rec["device_id"] = f"dev_guest_{self.rng.integers(100, 999)}"
            rec["ip_address"] = f"192.168.{self.rng.integers(1, 255)}.{self.rng.integers(1, 255)}"
            rec["category"] = self.rng.choice(all_categories, p=fraud_cat_probs)
            rec["channel"] = self.rng.choice([ChannelType.WEB.value, ChannelType.MOBILE.value])
            rec["fraud_archetype"] = "account_takeover"

        # Inject Mule Ring / Smurfing transactions
        mule_slots = self.rng.choice(
            [
                i
                for i in range(int(n_transactions * 0.15), n_transactions)
                if legit_records[i]["is_fraud"] == 0
            ],
            size=n_mule,
            replace=False,
        )
        for idx in mule_slots:
            rec = legit_records[idx]
            ring = ring_members[self.rng.integers(0, len(ring_members))]
            # Cycle transfer: A -> B, B -> C, C -> D
            src_idx = self.rng.integers(0, len(ring))
            dst_idx = (src_idx + 1) % len(ring)
            rec["is_fraud"] = 1
            rec["sender_id"] = ring[src_idx]
            rec["receiver_id"] = (
                ring[dst_idx] if self.rng.random() < 0.80 else self.rng.choice(merchants)
            )
            # Realistic transfer amounts ($1,200 - $3,500)
            base_amount = 2200.0 if self.rng.random() < 0.5 else 1400.0
            rec["amount"] = round(float(base_amount + self.rng.uniform(-200.0, 500.0)), 2)
            rec["channel"] = (
                ChannelType.WIRE.value if self.rng.random() < 0.5 else ChannelType.P2P.value
            )
            rec["category"] = self.rng.choice(
                ["money_transfer", "crypto_exchange", "wire_service", "retail"]
            )
            rec["fraud_archetype"] = "mule_cycle"

        # Inject Rapid Velocity Blasts (card testing -> cash out)
        # Cluster of 5-8 transactions in 10 minutes
        velocity_targets = self.rng.choice(users, size=max(1, n_velocity // 5), replace=False)
        vel_slots = sorted(
            self.rng.choice(
                [
                    i
                    for i in range(int(n_transactions * 0.2), n_transactions - 10)
                    if legit_records[i]["is_fraud"] == 0
                ],
                size=max(1, n_velocity // 5),
                replace=False,
            )
        )
        for anchor_idx in vel_slots:
            target_user = self.rng.choice(velocity_targets)
            anchor_ts = legit_records[anchor_idx]["timestamp"]
            for step in range(5):
                cur_idx = min(anchor_idx + step, n_transactions - 1)
                rec = legit_records[cur_idx]
                rec["is_fraud"] = 1
                rec["sender_id"] = target_user
                rec["receiver_id"] = f"fast_digital_{step}_{self.rng.integers(1, 10)}"
                rec["timestamp"] = anchor_ts + timedelta(
                    seconds=float(step * self.rng.integers(15, 60))
                )
                # Testing cards with small amounts, then draining
                if step < 2:
                    rec["amount"] = round(float(self.rng.uniform(1.99, 4.99)), 2)
                else:
                    rec["amount"] = round(float(self.rng.uniform(499.00, 1999.00)), 2)
                rec["channel"] = ChannelType.MOBILE.value
                rec["category"] = "gaming" if step < 2 else "crypto_exchange"
                rec["fraud_archetype"] = "velocity_blast"

        # Re-sort strictly by timestamp to guarantee zero lookahead leakage
        df = pd.DataFrame(legit_records)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)
        # Regenerate sequential IDs
        df["transaction_id"] = [f"tx_{i:07d}" for i in range(len(df))]

        return df

    def to_canonical_objects(self, df: pd.DataFrame) -> List[Transaction]:
        """Converts dataframe rows into validated Transaction Pydantic objects."""
        transactions = []
        for _, row in df.iterrows():
            tx = Transaction(
                transaction_id=str(row["transaction_id"]),
                timestamp=row["timestamp"].to_pydatetime()
                if hasattr(row["timestamp"], "to_pydatetime")
                else row["timestamp"],
                sender_id=str(row["sender_id"]),
                receiver_id=str(row["receiver_id"]),
                amount=float(row["amount"]),
                currency=str(row.get("currency", "USD")),
                channel=ChannelType(str(row.get("channel", "mobile"))),
                device_id=str(row["device_id"]) if pd.notna(row.get("device_id")) else None,
                ip_address=str(row["ip_address"]) if pd.notna(row.get("ip_address")) else None,
                location=str(row["location"]) if pd.notna(row.get("location")) else None,
                category=str(row["category"]) if pd.notna(row.get("category")) else "retail",
                is_fraud=int(row["is_fraud"])
                if "is_fraud" in row and pd.notna(row["is_fraud"])
                else None,
                dataset_designation=DatasetDesignation.SYNTHETIC,
                metadata={"fraud_archetype": str(row.get("fraud_archetype", "none"))},
            )
            transactions.append(tx)
        return transactions
