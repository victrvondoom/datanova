# Architecture Intelligence Benchmark (Campaign 03, Task 41)

**Implementation:** `engines/benchmark.ts`; executed and rendered in
`panels/Capstone.tsx`; tests in `__tests__/m9.test.ts` and `e2e/lab.spec.ts`.

## Corpus (4 items, all built-in)

| item | kind | ground truth (expected critic findings) |
|---|---|---|
| docflow | valid, real tensions | 3 SPOF + 2 idempotency findings (cn-worker-notify is async: the sync-without-timeout rule correctly does NOT fire) |
| flawed-checkout | flawed | 3 SPOF + idempotency + orphan + sync-external-without-timeout |
| over-engineered (DocFlow + unjustified Kafka) | over-engineered | docflow's findings + `critic-orphan:kafka` (the item measures the delta) |
| minimal (no operations) | minimal | 2 orphans; must-not-flag: SPOF (no critical paths exist by design) |

## Metrics (computed from EXECUTED runs, never invented)

Per item: true/false positives, false negatives, precision, recall,
false-positive rate, and unsupported-claim rate (every finding's evidence refs
must resolve in the model — currently 0). Summary means are reported with the
delta against a previous run when supplied.

## Latest executed result (this session, engines as shipped)

precision 1.000, recall 1.000, false-positive rate 0.000, unsupported-claim
rate 0.000 — all ground-truth findings found, nothing extra flagged, every
claim grounded. (Verified again by `e2e/lab.spec.ts` against the production
build.)

## Limitations (stated in every report)

- The corpus scores the CRITIC rule set; causal/blast-radius engines are
  exercised by their own unit suites, not scored here.
- Ground truth reflects documented system-design principles and must be
  updated together with any rule change.
- Metrics are over finding IDs; severity calibration is not modeled.
