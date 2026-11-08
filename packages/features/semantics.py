"""Semantic feature registry (catalog: feat_semantic_names_registry).

Every model feature gets a definition, unit, family, and derivation source
so that features cannot be used without understanding. The registry is
validated against the actual champion artifact schema and the pipeline —
`validate_coverage()` raises for any feature it cannot explain, so the
registry can never silently drift from the implementation.

Definitions below were read directly from `packages/features/temporal.py`
and `packages/features/pipeline.py` (see derived_from), not invented.
"""

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Tuple


@dataclass(frozen=True)
class FeatureSemantics:
    name: str
    definition: str
    unit: str
    family: str
    derived_from: List[str] = field(default_factory=list)


# Structural features (fixed names produced by TemporalFeatureExtractor).
FEATURE_SEMANTICS: Dict[str, FeatureSemantics] = {
    "log_amount": FeatureSemantics(
        "log_amount",
        "Natural log of (transaction amount + 1) via np.log1p; compresses the "
        "heavy-tailed amount distribution for scale-sensitive models.",
        "log(1 + currency units)",
        "amount",
        ["packages/features/temporal.py: np.log1p(df[amount_col])"],
    ),
    "hour_of_day": FeatureSemantics(
        "hour_of_day",
        "Local calendar hour of the transaction timestamp (0-23).",
        "hours [0, 23]",
        "time",
        ["packages/features/temporal.py: ts.dt.hour"],
    ),
    "day_of_week": FeatureSemantics(
        "day_of_week",
        "ISO weekday of the transaction timestamp (Monday=0 ... Sunday=6).",
        "weekday index [0, 6]",
        "time",
        ["packages/features/temporal.py: ts.dt.dayofweek"],
    ),
    "is_weekend": FeatureSemantics(
        "is_weekend",
        "1 when the transaction falls on Saturday or Sunday, else 0.",
        "binary {0, 1}",
        "time",
        ["packages/features/temporal.py: dow >= 5"],
    ),
    "hour_sin": FeatureSemantics(
        "hour_sin",
        "Cyclical sine encoding of hour_of_day (period 24) so 23:00 and 00:00 "
        "are close in feature space.",
        "dimensionless [-1, 1]",
        "time",
        ["packages/features/temporal.py: sin(2*pi*hour/24)"],
    ),
    "hour_cos": FeatureSemantics(
        "hour_cos",
        "Cyclical cosine encoding of hour_of_day (period 24); paired with "
        "hour_sin to make the daily cycle unambiguous.",
        "dimensionless [-1, 1]",
        "time",
        ["packages/features/temporal.py: cos(2*pi*hour/24)"],
    ),
    "dow_sin": FeatureSemantics(
        "dow_sin",
        "Cyclical sine encoding of day_of_week (period 7).",
        "dimensionless [-1, 1]",
        "time",
        ["packages/features/temporal.py: sin(2*pi*dow/7)"],
    ),
    "dow_cos": FeatureSemantics(
        "dow_cos",
        "Cyclical cosine encoding of day_of_week (period 7); paired with "
        "dow_sin.",
        "dimensionless [-1, 1]",
        "time",
        ["packages/features/temporal.py: cos(2*pi*dow/7)"],
    ),
    "tx_count_1h": FeatureSemantics(
        "tx_count_1h",
        "Count of the sender's prior transactions in the trailing 1 hour "
        "(strictly prior events only; causal).",
        "count",
        "velocity",
        ["packages/features/temporal.py: events_1h"],
    ),
    "tx_count_24h": FeatureSemantics(
        "tx_count_24h",
        "Count of the sender's prior transactions in the trailing 24 hours "
        "(strictly prior events only; causal).",
        "count",
        "velocity",
        ["packages/features/temporal.py: events_24h"],
    ),
    "tx_amount_sum_24h": FeatureSemantics(
        "tx_amount_sum_24h",
        "Sum of the sender's prior transaction amounts in the trailing 24 "
        "hours (0 when no prior history).",
        "currency units",
        "velocity",
        ["packages/features/temporal.py: sum(e[1] for e in events_24h)"],
    ),
    "amount_ratio_24h": FeatureSemantics(
        "amount_ratio_24h",
        "Current amount divided by the sender's mean prior 24h amount "
        "(floored denominator of 1.0; 1.0 when no prior history). Values > 1 "
        "mean the current transaction is larger than the sender's recent "
        "average.",
        "ratio (dimensionless)",
        "velocity",
        ["packages/features/temporal.py: amt / max(1.0, mean_amt)"],
    ),
    "time_since_prev_sec": FeatureSemantics(
        "time_since_prev_sec",
        "Seconds since the sender's previous transaction (default 86400.0 "
        "when this is the first observed transaction).",
        "seconds",
        "velocity",
        ["packages/features/temporal.py: default 86400"],
    ),
    "log_time_since_prev": FeatureSemantics(
        "log_time_since_prev",
        "Natural log of (time_since_prev_sec + 1) via np.log1p; compresses "
        "the inter-arrival time scale.",
        "log(1 + seconds)",
        "velocity",
        ["packages/features/temporal.py: np.log1p(time_since_prev_sec)"],
    ),
    "distinct_devices_24h": FeatureSemantics(
        "distinct_devices_24h",
        "Distinct non-missing device identifiers used by the sender in the "
        "trailing 24 hours, including the current device (1 when no prior "
        "history).",
        "count",
        "diversity",
        ["packages/features/temporal.py: device set union"],
    ),
    "distinct_ips_24h": FeatureSemantics(
        "distinct_ips_24h",
        "Distinct non-missing IP addresses used by the sender in the "
        "trailing 24 hours, including the current IP (1 when no prior "
        "history).",
        "count",
        "diversity",
        ["packages/features/temporal.py: ip set union"],
    ),
    "distinct_receivers_24h": FeatureSemantics(
        "distinct_receivers_24h",
        "Distinct receivers paid by the sender in the trailing 24 hours, "
        "including the current receiver (1 when no prior history).",
        "count",
        "diversity",
        ["packages/features/temporal.py: receiver set union"],
    ),
    "is_velocity_surge": FeatureSemantics(
        "is_velocity_surge",
        "1 when the sender shows a velocity surge: at least 3 prior "
        "transactions in the last hour OR at least 2 distinct devices in 24 "
        "hours; else 0.",
        "binary {0, 1}",
        "velocity",
        ["packages/features/temporal.py: (tx_count_1h >= 3) | (distinct_devices_24h >= 2)"],
    ),
    "g_out_degree": FeatureSemantics(
        "g_out_degree",
        "Count of outbound transaction edges initiated by the sender in the trailing 24 hours.",
        "count",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_sender_out_degree)"],
    ),
    "g_in_degree": FeatureSemantics(
        "g_in_degree",
        "Count of inbound transaction edges received by the receiver in the trailing 24 hours.",
        "count",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_receiver_in_degree)"],
    ),
    "g_dev_shared": FeatureSemantics(
        "g_dev_shared",
        "Number of distinct accounts that have transacted from the current device identifier in the trailing graph window.",
        "count",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_device_shared_accounts)"],
    ),
    "g_cycle": FeatureSemantics(
        "g_cycle",
        "1 when a directed cycle / circular flow of length 1 to 3 hops exists from receiver back to sender, closing a laundering ring; else 0.",
        "binary {0, 1}",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_cycle_detected)"],
    ),
    "g_recip": FeatureSemantics(
        "g_recip",
        "1 when a direct reciprocal flow exists (receiver previously sent funds to sender in graph history); else 0.",
        "binary {0, 1}",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_is_reciprocal)"],
    ),
    "g_pagerank": FeatureSemantics(
        "g_pagerank",
        "Temporal PageRank centrality score of the sender in the transaction graph.",
        "score [0, 1]",
        "graph",
        ["packages/graph/features.py: GraphFeatureExtractor.extract_features_for_transaction (graph_sender_pagerank)"],
    ),
}


# Dynamic one-hot families: vocabulary comes from the training partition
# (FeaturePipeline.known_channels / known_categories), so definitions are
# generated by rule rather than enumerated.
DYNAMIC_PREFIX_RULES: Dict[str, Tuple[str, str, str]] = {
    "ch_": (
        "Payment channel indicator: 1 when the transaction channel is "
        "'{value}', else 0.",
        "binary {0, 1}",
        "categorical-indicator",
    ),
    "cat_": (
        "Merchant category indicator: 1 when the merchant category is "
        "'{value}', else 0.",
        "binary {0, 1}",
        "categorical-indicator",
    ),
}


def describe_feature(name: str) -> FeatureSemantics:
    """Returns the semantics of one feature or raises KeyError.

    Unknown structural features and unknown dynamic prefixes both raise —
    an unexplained feature is a defect, not a documentation gap to paper
    over.
    """
    if name in FEATURE_SEMANTICS:
        return FEATURE_SEMANTICS[name]
    for prefix, (template, unit, family) in DYNAMIC_PREFIX_RULES.items():
        if name.startswith(prefix):
            value = name[len(prefix):]
            if not value:
                break
            return FeatureSemantics(
                name=name,
                definition=template.format(value=value),
                unit=unit,
                family=family,
                derived_from=["packages/features/pipeline.py: _encode_categoricals"],
            )
    raise KeyError(
        f"No semantic definition registered for feature '{name}'. "
        "Add it to packages/features/semantics.py with its derivation source."
    )


def validate_coverage(feature_names: Iterable[str]) -> List[FeatureSemantics]:
    """Validates that every feature name in an artifact schema is explainable.

    Returns the registry entries in schema order; raises KeyError naming the
    first unexplained feature otherwise.
    """
    return [describe_feature(n) for n in feature_names]


def semantic_families() -> Dict[str, List[str]]:
    """Groups all registered feature names by family (for docs and UI)."""
    families: Dict[str, List[str]] = {}
    for name in FEATURE_SEMANTICS:
        families.setdefault(FEATURE_SEMANTICS[name].family, []).append(name)
    for prefix in DYNAMIC_PREFIX_RULES:
        families.setdefault(DYNAMIC_PREFIX_RULES[prefix][2], []).append(f"<{prefix}*>")
    return families
