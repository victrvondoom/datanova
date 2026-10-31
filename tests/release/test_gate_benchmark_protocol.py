"""RELEASE GATE 1 — Benchmark protocol leakage gate.

This is a MANDATORY release gate (see RELEASE_GATES.md). It validates the ACTUAL
production benchmark path (`scripts/run_benchmarks.run_benchmark_suite`), not a
helper function.

Adversarial fixture: two runs of the real pipeline that differ ONLY in the
held-out TEST labels (via the documented leakage self-verification hook).
Because champion selection uses validation PR-AUC and policy thresholds are
fitted on validation data only, the champion model and the frozen policy must
be IDENTICAL across both runs — while the reported test metrics must DIFFER
(proving the mutation actually took effect, so the invariance assertion is not
vacuous).

If anyone reintroduces test-based selection, threshold tuning, or calibration
choice on test data, run B's champion or policy changes and this gate FAILS.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from scripts.run_benchmarks import run_benchmark_suite

# Small-but-real configuration so the gate runs the full production path
# (generation, chronological split, feature fit, 6 models, calibration,
# exact policy fitting, frozen test evaluation) in CI time.
GATE_KWARGS = dict(
    n_transactions=1200,
    n_estimators=25,
    fraud_ratio=0.05,
    seed=42,
    write_reports=False,
    save_champion=False,
)


def _run(tmp, flip):
    artifact_dir = os.path.join(tmp, f"artifacts_{int(flip)}")
    experiments_dir = os.path.join(tmp, f"experiments_{int(flip)}")
    reports_dir = os.path.join(tmp, f"reports_{int(flip)}")
    manifests_dir = os.path.join(tmp, f"manifests_{int(flip)}")
    for d in (artifact_dir, experiments_dir, reports_dir, manifests_dir):
        os.makedirs(d, exist_ok=True)
    artifact = run_benchmark_suite(
        **GATE_KWARGS,
        test_label_flip_fraction=0.30 if flip else 0.0,
        artifact_dir=artifact_dir,
        experiments_dir=experiments_dir,
        reports_dir=reports_dir,
        manifests_dir=manifests_dir,
    )
    return artifact


@pytest.fixture(scope="module")
def two_runs(tmp_path_factory):
    tmp = str(tmp_path_factory.mktemp("leakage_gate"))
    return _run(tmp, flip=False), _run(tmp, flip=True)


def test_champion_selection_is_invariant_to_test_labels(two_runs):
    run_a, run_b = two_runs
    assert run_a["champion_model_name"] == run_b["champion_model_name"], (
        "Champion selection changed when ONLY test labels changed: test data is "
        "leaking into model selection. This is a P0 protocol violation."
    )


def test_frozen_policy_is_invariant_to_test_labels(two_runs):
    run_a, run_b = two_runs
    pol_a = run_a["policy_comparisons"]["aegis_cost_optimized"]["policy"]
    pol_b = run_b["policy_comparisons"]["aegis_cost_optimized"]["policy"]
    for key in ("tau_allow", "tau_review", "tau_block"):
        assert pol_a[key] == pol_b[key], (
            f"Policy threshold {key} changed when ONLY test labels changed: "
            "test data is leaking into policy fitting. P0 protocol violation."
        )


def test_calibrator_inputs_are_invariant_to_test_labels(two_runs):
    """The champion validation scores (policy-fitting inputs) must be identical."""
    run_a, run_b = two_runs
    assert run_a["champion_validation_scores"] == run_b["champion_validation_scores"], (
        "Champion validation scores changed when ONLY test labels changed: "
        "test data leaked into the scoring path. P0 protocol violation."
    )


def test_label_mutation_actually_changed_test_metrics(two_runs):
    """Vacuity guard: the flip must materially change reported test metrics."""
    run_a, run_b = two_runs
    test_a = run_a["benchmark_summary"][run_a["champion_model_name"]]
    test_b = run_b["benchmark_summary"][run_b["champion_model_name"]]
    assert test_a["pr_auc"] != test_b["pr_auc"], (
        "Test-label flip did not change reported test PR-AUC. The invariance "
        "assertions above would be vacuous — fixture is broken."
    )
    # And the frozen-policy test evaluation must also have changed
    met_a = run_a["policy_comparisons"]["aegis_cost_optimized"]["metrics"]
    met_b = run_b["policy_comparisons"]["aegis_cost_optimized"]["metrics"]
    assert met_a["total_cost"] != met_b["total_cost"]


def test_benchmark_records_split_and_protocol_configuration(two_runs):
    run_a, _ = two_runs
    dm = run_a["dataset_manifest"]
    # The manifest must record the actual chronological split strategy and
    # partition sizes that produced every reported number.
    assert "60_20_20" in dm["split_strategy"]
    assert dm["train_count"] + dm["val_count"] + dm["test_count"] == dm["record_count"]
    # Every model entry reports the validation PR-AUC that drove selection
    for name, m in run_a["benchmark_summary"].items():
        assert "validation_pr_auc" in m, f"{name} missing validation_pr_auc"
    # Policy fit metrics are recorded from the validation split
    reg = run_a["optimization_regret"]
    assert reg["fit_split"] == "validation"
    assert reg["exact_solver"]["status"] == "OPTIMAL"
