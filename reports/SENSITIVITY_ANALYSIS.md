# AEGIS-Fraud X — Policy Sensitivity Analysis

**Generated:** 2026-11-04 08:40:57 UTC
**Method:** Exact policy optimizer re-fitted on the FROZEN champion
validation scores for each parameter setting. Validation data only —
no test-set information is used anywhere in this analysis.
**Economic parameters are documented modeling assumptions, not measured bank costs.**

Baseline configuration: {'investigation_cost': 15.0, 'customer_friction_cost': 5.0, 'friction_block_cost': 25.0, 'challenge_cost': 0.1, 'challenge_efficiency': 0.88, 'investigation_efficiency': 0.98, 'max_fpr': 0.015, 'review_capacity_daily': 100}

## Baseline policy

```json
{
  "status": "OPTIMAL",
  "tau_allow": 0.1818,
  "tau_review": 0.5,
  "tau_block": 0.5,
  "val_cost": 1912.94,
  "fpr": 0.01223,
  "allow": 1944,
  "challenge": 31,
  "review": 0,
  "block": 25
}
```

## Sweep: `investigation_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 5.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 15.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 30.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 60.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |

## Sweep: `customer_friction_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,879.94 | 1.22% |
| 5.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 15.0 | OPTIMAL | 0.1818 | 0.3529 | 0.3529 | 1944 | 14 | 0 | 42 | 1,968.93 | 1.22% |
| 30.0 | OPTIMAL | 0.1818 | 0.3529 | 0.3529 | 1944 | 14 | 0 | 42 | 2,018.43 | 1.22% |

## Sweep: `friction_block_cost`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 5.0 | OPTIMAL | 0.1818 | 0.1818 | 0.1818 | 1944 | 0 | 0 | 56 | 1,635.95 | 1.22% |
| 10.0 | OPTIMAL | 0.1818 | 0.3529 | 0.3529 | 1944 | 14 | 0 | 42 | 1,740.93 | 1.22% |
| 25.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 50.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,962.94 | 1.22% |
| 100.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 2,062.94 | 1.22% |

## Sweep: `max_fpr`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.001 | OPTIMAL | 1.0 | 1.0 | 1.0 | 1979 | 0 | 0 | 21 | 6,042.34 | 0.00% |
| 0.005 | OPTIMAL | 0.5 | 0.5 | 0.5 | 1975 | 0 | 0 | 25 | 4,156.72 | 0.10% |
| 0.015 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 0.03 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 0.05 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |

## Sweep: `review_capacity_daily`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 20 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 50 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 100 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 200 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 400 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |

## Sweep: `challenge_efficiency`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.5 | OPTIMAL | 0.1818 | 0.1818 | 0.1818 | 1944 | 0 | 0 | 56 | 2,115.95 | 1.22% |
| 0.7 | OPTIMAL | 0.1818 | 0.3529 | 0.3529 | 1944 | 14 | 0 | 42 | 2,051.55 | 1.22% |
| 0.88 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 0.95 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,731.59 | 1.22% |
| 0.99 | OPTIMAL | 0.1818 | 1.0 | 1.0 | 1944 | 35 | 0 | 21 | 1,600.71 | 1.22% |

## Sweep: `investigation_efficiency`

| Value | Status | tau_allow | tau_review | tau_block | Allow | Challenge | Review | Block | Val Cost ($) | FPR |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0.5 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 0.8 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 0.98 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |
| 1.0 | OPTIMAL | 0.1818 | 0.5 | 0.5 | 1944 | 31 | 0 | 25 | 1,912.94 | 1.22% |

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
