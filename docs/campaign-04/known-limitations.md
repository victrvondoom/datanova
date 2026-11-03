# Campaign 04 — Known Limitations

Honest gaps that remain after Campaign 04. Each entry states what is
actually implemented and what is not.

## Manual assistive-technology testing NOT YET RUN

`e2e/lab-a11y.spec.ts` provides **browser-level** coverage: keyboard
operation, accessible names, label+icon+color severity/evidence badges,
form labels, canvas text alternative, and an accessibility-tree snapshot.
These verify the DOM/accessibility-tree contract, **not** what a real
screen reader announces (speech synthesis, virtual cursors, heuristics).

`docs/campaign-04/screen-reader-protocol.md` defines the exact manual
protocol (NVDA/Chromium, VoiceOver/Safari, JAWS, Narrator) with expected
announcements — its run log honestly reads **NOT YET RUN**. This is the
campaign's highest-value follow-up and requires installed assistive
technology and a human tester.

## Benchmark is a synthetic self-consistency instrument

The benchmark v2 (`engines/benchmark2.ts`, 8 dimensions, 29 scenarios)
scores the lab's engines against **authored expected outcomes in a
synthetic corpus**. It is a regression and self-consistency instrument:

- It detects when engine changes break documented reasoning (REGRESSION
  GATE in `c04-benchmark.test.ts`).
- It does **not** measure agreement with real-world architecture reviews,
  expert judgment, or production behavior. No external validation of the
  corpus has been performed, and reports never claim it.

## No real telemetry anywhere in the lab

All lab numbers (latency, queue depth, SLO outcomes, cost, recovery) are
**deterministic model outputs** with declared assumptions. The evidence
taxonomy supports an `observed` kind, but the lab itself produces none —
only user-supplied data could. No lab output is production telemetry, and
the UI labels evidence kinds (`inferred`, `simulated`, `user-authored`) to
keep that distinction visible.

## Recovery timelines inherit their model's scope

`recovery-timeline.ts` reconstructs phases from **recorded simulation
runs** (flight recorder). It does not model real infrastructure
restoration (e.g., DNS failover, replica promotion timing); bottlenecks
are model bottlenecks. Unsupported recovery strategies are absent from
timelines rather than approximated.

## Sensitivity analysis sweeps declared parameters only

`engines/sensitivity.ts` varies the assumption parameters the model
declares (peak rate, processing time, capacity, deadline). Conclusions
dependent on unmodeled factors (e.g., garbage-collection pauses, network
jitter distributions) are out of scope and not claimed.

## Tenant-isolation matrix covers modeled paths only

The matrix (`engines/tenantmatrix.ts`) executes against modeled data
holders and declared isolation mechanisms. It cannot discover isolation
gaps that exist only in real deployments (misconfigured network policies,
shared caches outside the model). Findings are labeled as modeled.

## Trail visual baselines: regenerated-baseline hazard

The trail topic-01 visual baseline is now deterministic (banner-wait +
clock-freeze; stable across three consecutive full-spec runs). However, a
mid-campaign `--update-snapshots` run was observed to capture an anomalous
one-off page state; it was detected by diffing fresh runs against the
committed baseline and discarded. Practice going forward: only regenerate
baselines after an intentional visual change, and sanity-check the
regeneration against multiple fresh runs (see `decision-log.md` D06).

## Two-phase E2E requires manual environment control

Phase A (offline) and phase B (API on :8002) require the operator to
start/stop the API per `scripts/run_e2e.md`; the suite does not manage the
API lifecycle itself. This is inherited from Campaign 03 and unchanged.

## Lab has no backend persistence

By design, the lab persists to browser localStorage behind injectable
storage interfaces. Multi-user sharing relies on export/import of
experiment packages and evidence packs, not a server.
