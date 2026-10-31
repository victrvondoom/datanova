# AEGIS-Fraud X — Optimization Methodology

## 1. Problem formulation

A policy is three thresholds `tau_allow <= tau_review <= tau_block` partitioning
transactions by calibrated fraud probability `p`:

| Action | Condition | Realized cost (fraud) | Realized cost (legit) |
|:---|:---|:---|:---|
| ALLOW | `p < tau_allow` | `amount` | 0 |
| CHALLENGE | `tau_allow <= p < tau_review` | `c_auto + (1-eta_ch)*amount` | `c_auto + 0.3*c_fric` |
| REVIEW | `tau_review <= p < tau_block` | `c_inv + (1-eta_rev)*amount` | `c_inv + c_fric` |
| BLOCK | `p >= tau_block` | 0 | `c_block` |

Cost parameters and semantics live in ONE place:
`packages/data/schemas.py::CostConfiguration` +
`packages/optimization/cost_engine.py` (the same engine serves benchmark
reporting, the API, the Digital Twin, and the optimizer's verification).

**Constraints** (evaluated on the fitting data):
- `FPR = #legit(p >= tau_allow) / n_legit <= max_fpr` (challenged legit are
  false alarms too — the constraint depends ONLY on the allow cut)
- `#tx(tau_review <= p < tau_block) <= cap_cnt` with
  `cap_cnt = floor(review_capacity_daily / max(100, n) * n)`

**Objective:** minimize total realized cost on the fitting (validation) data.

## 2. Exact solver (`packages/optimization/exact_optimizer.py`)

**Completeness.** Threshold policies cannot split tied scores, and every
threshold policy corresponds to cutting the sorted population at *distinct
probability values*; conversely every distinct-value cut triple is realizable
(`tau = u[cut]`; the boundary "above all values" is `tau = 1.0`, valid exactly
when no probability equals 1.0). The solver enumerates ALL realizable cut
triples `(i, j, k)` — it is an exact optimum, not a grid approximation.

**Algorithm (O(m log m), m = distinct values).**
1. Group transactions by distinct probability; aggregate per-group action costs.
2. Prefix/suffix cost arrays `PA, PC, PR, SB` make any cut triple's cost O(1):
   `cost(i,j,k) = [PA(i)-PC(i)] + [PC(j)-PR(j)] + [PR(k)+SB(k)]`.
3. The FPR constraint gives a minimum allow cut `i_min` directly.
4. For each review cut `j`, the block cut `k` ranges over a review-capacity
   window; a sparse-table range minimum over `G(k)=PR(k)+SB(k)` gives `M(j)`.
5. A right-to-left suffix minimum of `H(j)=PC(j)-PR(j)+M(j)` gives `S(i)`;
   the best `i` is a linear scan.
6. Deterministic tie-break: among optima (within 1e-9), the lexicographically
   smallest `(i, j, k)` (most permissive allow first).
7. The chosen thresholds are re-verified with the authoritative CostEngine;
   any constraint violation or cost disagreement raises
   `InfeasiblePolicyError` — **an infeasible policy is never returned as
   success**.

**Brute-force verification.** `tests/unit/test_exact_optimizer.py` compares
the solver against an independent naive O(m^3) enumeration on 13 fixtures
(tied scores, zero-inflation, all-ones infeasibility, single record, tight
capacity, deterministic tie-breaking). During development this fixture suite
caught a real sliding-window bug (deque expired window members permanently).

## 3. Regret: exact vs legacy coarse grid

The legacy percentile grid (`PolicyOptimizer.optimize_policy_coarse_grid`) is
retained ONLY as a diagnostic. The benchmark artifact records
(`benchmarks/runs/benchmark_summary.json::optimization_regret`):

- **Optimization gap (validation):** `coarse_val_cost - exact_val_cost`.
  Current run: **$0.00** — the coarse grid happened to find the optimum on
  this data. The exact solver's contribution is the *guarantee* (complete
  enumeration + feasibility), not a numerical win on this dataset.
- **Out-of-sample:** both frozen policies evaluated once on the held-out test
  set (current run: identical, $5,376.27).
- Solve times and the coarse grid's constraint-violation caveat are recorded.

## 4. Sensitivity analysis

`scripts/run_policy_sensitivity.py` re-fits the exact solver on the frozen
champion validation scores (stored in the benchmark artifact) while sweeping
`investigation_cost`, `customer_friction_cost`, `friction_block_cost`,
`max_fpr`, `review_capacity_daily`, `challenge_efficiency`, and
`investigation_efficiency`. Output: `reports/SENSITIVITY_ANALYSIS.md`.
Validation data only — no test information anywhere.

**Economic finding (documented, not hidden):** under baseline assumptions
($15 investigation vs $0.10 challenge at 88% challenge efficacy), the
optimal policy uses the challenge tier and never the review tier; review
becomes worthwhile only when investigation is cheap or highly effective
relative to challenge. INFEASIBLE rows mean no realizable policy satisfies
the constraints for that parameter setting — the system refuses rather than
silently relaxing them.

## 5. What this is not

- Costs are simulated under documented modeling assumptions, not measured
  bank economics; savings figures are not realized savings.
- The optimizer operates on calibrated probabilities from the champion model;
  its guarantees are conditional on the cost model and the fitting data.
