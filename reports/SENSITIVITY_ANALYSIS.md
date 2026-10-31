# AEGIS-Fraud X — Policy Sensitivity Analysis

**Generated:** 2026-10-31 06:41:23 UTC
**Method:** Exact policy optimizer re-fitted on the FROZEN champion
validation scores for each parameter setting. Validation data only —
no test-set information is used anywhere in this analysis.
**Economic parameters are documented modeling assumptions, not measured bank costs.**

Baseline configuration: {'investigation_cost': 15.0, 'customer_friction_cost': 5.0, 'friction_block_cost': 25.0, 'challenge_cost': 0.1, 'challenge_efficiency': 0.88, 'investigation_efficiency': 0.98, 'max_fpr': 0.015, 'review_capacity_daily': 100}

## Baseline policy

```json
{
  "status": "OPTIMAL",
  "tau_allow": 0.2222,
  "tau_review": 1.0,
  "tau_block": 1.0,
  "val_cost": 4711.44,
  "fpr": 0.00357,
  "allow": 1966,
  "challenge": 9,
  "review": 0,
  "block": 25
}
```

## Sweep: `investigation_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 5.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 15.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 30.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 60.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |

## Sweep: `customer_friction_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,700.94 | 0.36% |
| 5.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 15.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,732.44 | 0.36% |
| 30.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,763.94 | 0.36% |

## Sweep: `friction_block_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 5.0 | OPTIMAL | 0.2222 | 0.2222 | 0.2222 | 1966 | 0 | 0 | 34 | 4,628.98 | 0.36% |
| 10.0 | OPTIMAL | 0.2222 | 0.2222 | 0.2222 | 1966 | 0 | 0 | 34 | 4,663.98 | 0.36% |
| 25.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 50.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 100.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |

## Sweep: `max_fpr`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.001 | OPTIMAL | 1.0 | 1.0 | 1.0 | 1975 | 0 | 0 | 25 | 5,477.83 | 0.00% |
| 0.005 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 0.015 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 0.03 | OPTIMAL | 0.1636 | 1.0 | 1.0 | 1911 | 64 | 0 | 25 | 1,394.86 | 2.70% |
| 0.05 | OPTIMAL | 0.0833 | 1.0 | 1.0 | 1899 | 76 | 0 | 25 | 1,074.04 | 3.26% |

## Sweep: `review_capacity_daily`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 20 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 50 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 100 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 200 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 400 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |

## Sweep: `challenge_efficiency`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.5 | OPTIMAL | 0.2222 | 0.2222 | 0.2222 | 1966 | 0 | 0 | 34 | 4,768.98 | 0.36% |
| 0.7 | OPTIMAL | 0.2222 | 0.2222 | 0.2222 | 1966 | 0 | 0 | 34 | 4,768.98 | 0.36% |
| 0.88 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 0.95 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,649.57 | 0.36% |
| 0.99 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,614.22 | 0.36% |

## Sweep: `investigation_efficiency`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.5 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 0.8 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 0.98 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |
| 1.0 | OPTIMAL | 0.2222 | 1.0 | 1.0 | 1966 | 9 | 0 | 25 | 4,711.44 | 0.36% |

## Interpretation notes

- The review tier activates only when investigation becomes cheap or
  highly effective relative to the challenge tier; with the baseline
  assumptions ($15 investigation vs $0.10 challenge at 88% efficacy),
  the challenge tier dominates. This is an economic property of the
  assumptions, not a defect of the solver.
- INFEASIBLE rows mean no realizable threshold policy satisfies the
  FPR and capacity constraints for that setting; the system must not
  silently relax constraints in that case.
- All costs here are validation-split simulated operating costs under
  the documented cost model. They are not realized bank savings.
