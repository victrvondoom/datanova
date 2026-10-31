"""Sensitivity analysis for the cost-aware decision policy.

Re-fits the EXACT policy optimizer on the frozen champion validation scores
(stored in benchmarks/runs/benchmark_summary.json) while sweeping each cost
parameter, and reports how the selected policy, action mix, and validation cost
respond. Out-of-sample claims are NOT produced here — this is a what-if tool
for decision-makers, fitted on validation data only.

Run:  python scripts/run_policy_sensitivity.py
Output: reports/SENSITIVITY_ANALYSIS.md
"""

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np

from packages.data.schemas import CostConfiguration
from packages.optimization.exact_optimizer import ExactPolicyOptimizer, InfeasiblePolicyError

ARTIFACT = "benchmarks/runs/benchmark_summary.json"
OUT = "reports/SENSITIVITY_ANALYSIS.md"

BASE = CostConfiguration()

SWEEPS = {
    "investigation_cost": [0.0, 5.0, 15.0, 30.0, 60.0],
    "customer_friction_cost": [0.0, 5.0, 15.0, 30.0],
    "friction_block_cost": [5.0, 10.0, 25.0, 50.0, 100.0],
    "max_fpr": [0.001, 0.005, 0.015, 0.03, 0.05],
    "review_capacity_daily": [20, 50, 100, 200, 400],
    "challenge_efficiency": [0.5, 0.7, 0.88, 0.95, 0.99],
    "investigation_efficiency": [0.5, 0.8, 0.98, 1.0],
}


def policy_summary(cfg, probs, amounts, labels):
    try:
        opt = ExactPolicyOptimizer(cfg)
        policy, metrics = opt.solve(probs, amounts, labels)
    except InfeasiblePolicyError as e:
        return {"status": "INFEASIBLE", "reason": str(e)}
    return {
        "status": metrics.get("optimization_status", "OPTIMAL"),
        "tau_allow": round(policy.tau_allow, 4),
        "tau_review": round(policy.tau_review, 4),
        "tau_block": round(policy.tau_block, 4),
        "val_cost": metrics["total_cost"],
        "fpr": metrics["false_positive_rate"],
        "allow": metrics["action_counts"]["ALLOW"],
        "challenge": metrics["action_counts"]["CHALLENGE"],
        "review": metrics["action_counts"]["REVIEW"],
        "block": metrics["action_counts"]["BLOCK"],
    }


def main():
    with open(ARTIFACT) as f:
        artifact = json.load(f)
    cvs = artifact["champion_validation_scores"]
    probs = np.array(cvs["probs"])
    amounts = np.array(cvs["amounts"])
    labels = np.array(cvs["labels"], dtype=int)

    lines = [
        "# AEGIS-Fraud X — Policy Sensitivity Analysis",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "**Method:** Exact policy optimizer re-fitted on the FROZEN champion",
        "validation scores for each parameter setting. Validation data only —",
        "no test-set information is used anywhere in this analysis.",
        "**Economic parameters are documented modeling assumptions, not measured"
        " bank costs.**",
        "",
        f"Baseline configuration: {BASE.model_dump()}",
        "",
        "## Baseline policy",
        "",
        "```json",
        json.dumps(policy_summary(BASE, probs, amounts, labels), indent=2),
        "```",
        "",
    ]

    for param, values in SWEEPS.items():
        lines += [
            f"## Sweep: `{param}`",
            "",
            "| Value | Status | tau_allow | tau_review | tau_block | "
            "Allow | Challenge | Review | Block | Val Cost ($) | FPR |",
            "|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|",
        ]
        for v in values:
            cfg = BASE.model_copy(update={param: v})
            s = policy_summary(cfg, probs, amounts, labels)
            if s["status"] != "OPTIMAL":
                lines.append(f"| {v} | {s['status']} | — | — | — | — | — | — | — | — | — |")
                continue
            lines.append(
                f"| {v} | OPTIMAL | {s['tau_allow']} | {s['tau_review']} | {s['tau_block']} "
                f"| {s['allow']} | {s['challenge']} | {s['review']} | {s['block']} "
                f"| {s['val_cost']:,.2f} | {s['fpr'] * 100:.2f}% |"
            )
        lines.append("")

    lines += [
        "## Interpretation notes",
        "",
        "- The review tier activates only when investigation becomes cheap or",
        "  highly effective relative to the challenge tier; with the baseline",
        "  assumptions ($15 investigation vs $0.10 challenge at 88% efficacy),",
        "  the challenge tier dominates. This is an economic property of the",
        "  assumptions, not a defect of the solver.",
        "- INFEASIBLE rows mean no realizable threshold policy satisfies the",
        "  FPR and capacity constraints for that setting; the system must not",
        "  silently relax constraints in that case.",
        "- All costs here are validation-split simulated operating costs under",
        "  the documented cost model. They are not realized bank savings.",
    ]

    os.makedirs("reports", exist_ok=True)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Sensitivity analysis written to {OUT}")


if __name__ == "__main__":
    main()
