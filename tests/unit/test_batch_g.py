"""Tests for Milestone 3 batch G.

Catalog features covered:
- feat_semantic_names_registry: validated semantic registry (no unexplained feature)
- explain_model_cards: generated, artifact-backed model card
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from packages.features.semantics import (
    describe_feature,
    validate_coverage,
)
from scripts.generate_feature_semantics import build as build_semantics
from scripts.generate_model_card import _load, build_card

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))


def _manifest():
    return _load(os.path.join(ROOT, "experiments/champion_bundle.pkl.manifest.json"))


# ---------------------------------------------------- feat_semantic_names_registry

def test_registry_explains_every_champion_feature():
    """Every feature in the served artifact schema has a definition."""
    manifest = _manifest()
    entries = validate_coverage(manifest["feature_names"])
    assert len(entries) == len(manifest["feature_names"])
    for e in entries:
        assert e.definition.strip()
        assert e.unit.strip()
        assert e.family.strip()
        assert e.derived_from  # every definition cites its source


def test_registry_rejects_unknown_features():
    """An unexplained feature is a defect, not a documentation gap."""
    with pytest.raises(KeyError, match="mystery_signal_v2"):
        validate_coverage(["log_amount", "mystery_signal_v2"])


def test_dynamic_indicator_rules():
    """ch_*/cat_* one-hots get generated definitions from the prefix rules."""
    ch = describe_feature("ch_wire")
    assert ch.unit == "binary {0, 1}"
    assert ch.definition.endswith("'wire', else 0.")
    cat = describe_feature("cat_travel")
    assert "'travel'" in cat.definition
    with pytest.raises(KeyError):
        describe_feature("ch_")  # empty dynamic value is not a feature


def test_semantics_generator_output_is_complete():
    """The generated registry documents all schema features, family-tagged."""
    manifest = _manifest()
    md, registry = build_semantics(
        manifest["feature_names"], manifest["model_id"], manifest["run_id"]
    )
    assert len(registry) == len(manifest["feature_names"]) == 33
    names = {r["name"] for r in registry}
    assert set(manifest["feature_names"]) == names
    assert "Feature Semantic Registry" in md
    assert "ch_web" in md and "log_amount" in md
    families = {r["family"] for r in registry}
    assert "velocity" in families and "categorical-indicator" in families


def test_generated_semantics_files_are_current():
    """Checked-in artifacts must match what generation would produce."""
    manifest = _manifest()
    with open(os.path.join(ROOT, "feature_semantics.json"), encoding="utf-8") as f:
        checked_in = json.load(f)
    assert checked_in["feature_count"] == len(manifest["feature_names"])
    assert checked_in["run_id"] == manifest["run_id"]


# ---------------------------------------------------- explain_model_cards

def test_model_card_reads_only_real_artifacts():
    """The card reproduces the manifest's own numbers, nothing invented."""
    card = build_card(
        _load(os.path.join(ROOT, "experiments/champion_bundle.pkl.manifest.json")),
        _load(os.path.join(ROOT, "benchmarks/runs/benchmark_summary.json")),
        _load(os.path.join(ROOT, "benchmarks/runs/ulb_evaluation.json")),
    )
    manifest = _manifest()
    champ = _load(os.path.join(ROOT, "benchmarks/runs/benchmark_summary.json"))[
        "benchmark_summary"
    ]["XGBoost"]

    assert manifest["run_id"] in card
    assert manifest["payload_sha256"] in card
    assert f"{champ['pr_auc']:.4f}" in card  # honest test PR-AUC
    assert f"{champ['validation_pr_auc']:.4f}" in card
    # simulated-vs-realized savings semantics
    assert "SIMULATED" in card
    assert "not realized bank savings" in card
    # required honesty sections
    assert "## Limitations" in card
    assert "SYNTHETIC" in card
    # ULB external validation included with the artifact's own numbers
    assert "ULB" in card
    ulb = _load(os.path.join(ROOT, "benchmarks/runs/ulb_evaluation.json"))
    assert f"{ulb['model_results']['XGBoost']['test_pr_auc']:.4f}" in card
    # PaySim blocked honestly
    assert "PaySim evaluation: BLOCKED" in card


def test_model_card_refuses_incomplete_manifest():
    """A card is never generated from an artifact missing required metadata."""
    manifest = _manifest()
    del manifest["payload_sha256"]
    benchmark = _load(os.path.join(ROOT, "benchmarks/runs/benchmark_summary.json"))
    with pytest.raises(ValueError, match="payload_sha256"):
        build_card(manifest, benchmark, None)


def test_model_card_refuses_unknown_champion():
    """The card never fabricates metrics for a champion absent from the run."""
    manifest = _manifest()
    manifest["model_id"] = "ghost_model_9000"
    benchmark = _load(os.path.join(ROOT, "benchmarks/runs/benchmark_summary.json"))
    with pytest.raises(ValueError, match="refusing to fabricate"):
        build_card(manifest, benchmark, None)
