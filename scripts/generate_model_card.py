"""Generates MODEL_CARD.md from the champion artifact manifest and benchmark
run artifacts (catalog: explain_model_cards).

Every number in the card is read from the recorded artifacts at generation
time — the card cannot drift from, or embellish, the underlying evidence.
Regenerate after a new champion: python scripts/generate_model_card.py
"""

import json
import os
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(ROOT, "experiments/champion_bundle.pkl.manifest.json")
BENCHMARK_PATH = os.path.join(ROOT, "benchmarks/runs/benchmark_summary.json")
ULB_PATH = os.path.join(ROOT, "benchmarks/runs/ulb_evaluation.json")
OUT_PATH = os.path.join(ROOT, "MODEL_CARD.md")

REQUIRED_MANIFEST_KEYS = (
    "run_id", "model_id", "model_version", "feature_names", "policy",
    "payload_sha256", "calibrator_method", "metadata",
)


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _fmt(x):
    return f"{x:.4f}" if isinstance(x, float) else str(x)


def build_card(manifest, benchmark, ulb):
    for key in REQUIRED_MANIFEST_KEYS:
        if key not in manifest:
            raise ValueError(f"Champion manifest is missing required key '{key}'; refusing to generate a model card from an incomplete artifact.")
    meta = manifest["metadata"]
    champ_name = manifest.get("model_id", "unknown")
    champ_metrics = None
    meta_champ = meta.get("champion_name")
    if meta_champ and meta_champ in benchmark.get("benchmark_summary", {}):
        if "lightgbm" in meta_champ.lower() and "lightgbm" in champ_name.lower():
            champ_metrics = benchmark["benchmark_summary"][meta_champ]
        elif meta_champ.split(" ")[0].lower() in champ_name.lower():
            champ_metrics = benchmark["benchmark_summary"][meta_champ]

    if champ_metrics is None:
        for name, m in benchmark.get("benchmark_summary", {}).items():
            if champ_name.lower().startswith(name.split(" ")[0].lower()):
                champ_metrics = m
                break
    if champ_metrics is None:
        raise ValueError(f"Champion '{champ_name}' not found in benchmark artifact; refusing to fabricate metrics.")
    fin = champ_metrics.get("financial_outcomes", {})
    manifest_ds = benchmark.get("dataset_manifest", {})

    lines = [
        "# Model Card — AEGIS-Fraud X Champion",
        "",
        f"Generated {datetime.now(timezone.utc).isoformat()} by "
        "`scripts/generate_model_card.py` from recorded artifacts. Every "
        "figure below is read from the champion manifest and benchmark run "
        "at generation time.",
        "",
        "## Model details",
        "",
        f"- Model: **{champ_name}** (version {manifest.get('model_version', '?')})",
        f"- Calibrator: {manifest.get('calibrator_method', '?')}",
        f"- Policy: {manifest['policy'].get('policy_name', '?')} "
        f"(tau_allow={_fmt(manifest['policy'].get('tau_allow', 0))}, "
        f"solver={meta.get('policy_solver', '?')})",
        f"- Artifact run id: `{manifest.get('run_id', '?')}`",
        f"- Artifact payload SHA-256: `{manifest.get('payload_sha256', '?')}`",
        f"- Feature schema: {len(manifest['feature_names'])} features "
        "(see FEATURE_SEMANTICS.md)",
        "",
        "## Intended use",
        "",
        "Real-time payment-transaction fraud screening as a DECISION-SUPPORT "
        "system: scores are consumed by the documented cost-aware policy to "
        "recommend ALLOW / CHALLENGE / REVIEW / BLOCK actions for human "
        "operations. Calibrated probabilities are required whenever a "
        "probability is interpreted as a fraud likelihood.",
        "",
        "## Out-of-scope use",
        "",
        "- Not a standalone identity-verification or sanctions-screening "
        "system.",
        "- Not to be used for automated irreversible customer-harm actions "
        "without human review; the emergency-stop control forces review.",
        "- Probabilities must not be presented as model outputs when the "
        "calibrator is missing or incompatible (the API refuses instead).",
        "",
        "## Data and evaluation",
        "",
        f"- Primary benchmark dataset: **{meta.get('dataset', manifest_ds.get('dataset_name', '?'))}** "
        f"({manifest_ds.get('record_count', '?')} records, "
        f"{manifest_ds.get('fraud_count', '?')} fraud, prevalence "
        f"{_fmt(manifest_ds.get('fraud_prevalence', float('nan'))) if isinstance(manifest_ds.get('fraud_prevalence'), float) else manifest_ds.get('fraud_prevalence', '?')})",
        f"- Split strategy: {meta.get('split_strategy', manifest_ds.get('split_strategy', '?'))} "
        "(champion selection, calibration fitting, and policy tuning are "
        "validation-only; the test partition is touched once for honest "
        "final evaluation — enforced by release gates "
        "`tests/release/`)",
        f"- Seed: {meta.get('seed', '?')}",
        "",
        "## Metrics (honest test partition, single final evaluation)",
        "",
        f"- PR-AUC (validation, selection): {_fmt(champ_metrics.get('validation_pr_auc', float('nan')))}",
        f"- PR-AUC (test, honest): **{_fmt(champ_metrics.get('pr_auc', float('nan')))}**",
        f"- ROC-AUC: {_fmt(champ_metrics.get('roc_auc', float('nan')))}",
        f"- Precision / Recall / F1: {_fmt(champ_metrics.get('precision', float('nan')))} / "
        f"{_fmt(champ_metrics.get('recall', float('nan')))} / {_fmt(champ_metrics.get('f1', float('nan')))}",
        f"- False-positive rate: {_fmt(champ_metrics.get('false_positive_rate', float('nan')))}",
        f"- Brier score / ECE: {_fmt(champ_metrics.get('brier_score', float('nan')))} / "
        f"{_fmt(champ_metrics.get('expected_calibration_error', float('nan')))}",
        f"- Inference latency: {_fmt(champ_metrics.get('inference_latency_ms_per_tx', float('nan')))} ms/tx",
        "",
        "## Economic outcomes (SIMULATED, not realized bank savings)",
        "",
        f"- Baseline cost with no detection: ${fin.get('baseline_cost_no_detection', 0):,.2f}",
        f"- Total operational cost under the AEGIS policy: ${fin.get('total_operational_cost', 0):,.2f}",
        f"- Simulated net savings vs. baseline: ${fin.get('estimated_net_savings', 0):,.2f}",
        "- These figures are produced by the shared cost engine under "
        "documented assumptions on this benchmark run; they are simulated "
        "estimates, not measured financial results.",
        "",
        "## External validation",
        "",
    ]
    if ulb:
        champ_ext = ulb.get("model_results", {}).get(ulb.get("champion_model_name", ""), {})
        lines += [
            f"- ULB Credit Card Fraud dataset ({ulb.get('provenance', {}).get('source', 'OpenML 1597')}): "
            f"champion **{ulb.get('champion_model_name', '?')}** validation PR-AUC "
            f"{_fmt(champ_ext.get('validation_pr_auc', float('nan')))}, honest test PR-AUC "
            f"**{_fmt(champ_ext.get('test_pr_auc', float('nan')))}** "
            f"(artifact: `benchmarks/runs/ulb_evaluation.json`).",
            "- PaySim evaluation: BLOCKED — dataset download requires Kaggle "
            "credentials that are not available in this environment. No "
            "PaySim results are claimed.",
            "",
        ]
    else:
        lines += [
            "- No external evaluation artifact found; external validation "
            "status is unknown for this card.",
            "",
        ]
    lines += [
        "## Limitations",
        "",
        "- Primary benchmark data is SYNTHETIC; absolute metrics are not "
        "evidence of real-world performance, only of protocol integrity.",
        "- The policy is tuned on validation data only; realized savings "
        "depend on cost assumptions that must be recalibrated per "
        "deployment.",
        "- Champion selection is validation-based; test metrics above are "
        "single-use and will lose honesty meaning if reused for selection.",
        "- The case store and ledger are in-memory single-process; "
        "multi-instance deployments need external state.",
        "",
        "## Provenance",
        "",
        f"- Manifest: `experiments/champion_bundle.pkl.manifest.json` "
        f"(benchmark artifact SHA-256 `{manifest.get('benchmark_artifact_sha256', '?')}`)",
        "- Generation is deterministic from the artifacts; regenerate after "
        "any champion promotion.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    try:
        manifest = _load(MANIFEST_PATH)
        benchmark = _load(BENCHMARK_PATH)
        ulb = _load(ULB_PATH) if os.path.exists(ULB_PATH) else None
        card = build_card(manifest, benchmark, ulb)
    except (OSError, ValueError, KeyError) as exc:
        print(f"ERROR generating model card: {exc}")
        return 1
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(card)
    print(f"Written {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
