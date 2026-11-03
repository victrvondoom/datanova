# Campaign 04 — Decision Log

Engineering decisions taken in Campaign 04, with rationale and consequences.
Where a decision touches honesty boundaries (benchmarks, simulations,
accessibility), the limitation it accepts is stated explicitly.

## D01 — Build on Campaign 03 instead of rebuilding

**Decision.** Map all 45 C04 tasks against the existing C03 implementation
first; implement only genuinely new capabilities. 43 of 45 tasks map onto
already-verified C03 modules; the new engineering concentrated on: T01
(a11y coverage + manual SR protocol), T02/T44 (benchmark v2), T03
(code-grounded inventory), T04 (determinism audit + proofs), T05 (evidence &
provenance), T06 (structured intent compiler), T16 (scenario engine), T20
(recovery timeline), T25 (sensitivity analysis), T34 (tenant-isolation
matrix), and the T45 capstone extensions.

**Rationale.** The campaign brief itself demands inspection before
implementation and forbids disconnected rebuilds. Re-implementing verified
capabilities would add risk without adding user value.

**Consequence.** The task ledger marks every work package honestly as
`VERIFIED (C03)` or `NEW (C04)` with per-WP evidence, so nothing inherited
is presented as new work.

## D02 — Evidence kinds: a closed four-value taxonomy

**Decision.** Every evidence artifact carries exactly one kind:
`observed`, `simulated`, `inferred`, or `user-authored`. Findings map to
kinds deterministically: engine findings = `inferred`, recorded runs =
`simulated` (with reproduction info), user notes = `user-authored`. Unknown
kinds are rejected at validation, not silently defaulted.

**Rationale.** "Where did this conclusion come from?" needs a vocabulary
small enough to reason about and strict enough to trust. The four kinds
separate measurement, replayable simulation, rule-based inference, and
human input.

**Consequence.** UI chips render the kind with label + icon (never color
alone — a11y-tested). `observed` is currently only producible by explicit
user-supplied data; the lab itself has no real telemetry (documented
limitation).

## D03 — Intent contradiction semantics: RAW vs deadline

**Decision.** The intent compiler flags "strict read-after-write required
inside an acknowledgement deadline shorter than the modeled sync write path"
as **contradictory**, and reports it as a problem with kind
`contradictory` instead of picking a winner. Incomplete inputs (e.g.
missing availability target) never produce invented values: they surface as
an explicit `UNRESOLVED` placeholder requirement the user must fill in.

**Rationale.** The campaign forbids hidden defaults that change
architectural meaning. Contradictions and gaps must be visible in the
review step, not silently resolved.

**Consequence.** The compiled starter model is always *valid* (canonical
schema) but visibly *incomplete*; adoption happens only after the user
reviews the problem list (e2e-tested flow).

## D04 — Benchmark v2: versioned schema, 8 dimensions, per-scenario ground truth

**Decision.** Keep the C03 critic benchmark (dimension `critic` in v2) and
build a new versioned benchmark (`schemaVersion: 2`) with 8 dimensions —
model validation, causal reasoning, counterfactual, consistency, security,
recovery, provenance, critic — over a corpus of 29 synthetic scenarios, each
with an expected outcome and rationale. A REGRESSION GATE test requires
every scenario to pass, and a reproducibility test requires identical
reports for identical inputs.

**Rationale.** The C03 report's own gap: the benchmark scored only critic
rules. Scoring the actual intelligence capabilities requires per-dimension
ground truth, and trust requires determinism.

**Consequence.** The benchmark is a **self-consistency and regression
instrument against a synthetic corpus** — it is not external validation,
and reports say so. No aggregate single score is produced (the campaign
forbids opaque universal scores).

## D05 — Scenario engine = composition, not a new simulator

**Decision.** `scenario.ts` does not introduce a second simulation model. A
scenario composes the existing `traffic.ts` workload generator with the
existing `orchestrator.ts` fault plan, binds to an architecture fingerprint,
and checks expectation outcomes derived from the engines' own models
(queue depth, SLO, latency, recovery), not blanket pass rules. Scenarios
authored against a different architecture are rejected.

**Rationale.** The repo rule "one canonical model" extends to simulation:
duplicating queueing/propagation logic in a scenario runner would fork the
truth.

**Consequence.** Expectation results are only emitted where the underlying
engine actually models the quantity — unsupported checks are absent rather
than guessed (honesty rule).

## D06 — Trail visual-baseline flake: wait for the banner, freeze the clock, restore the committed baseline

**Decision.** The `trail-a11y.spec.ts` topic-01 visual test was flaky
because the global "Backend offline" banner arrives asynchronously
(~1.5–4.5 s) and shifts the entire layout down. Fix: an explicit
`waitForSettledLayout` step waits for the banner **before**
`page.clock.install()` (which then freezes the token-bucket `setInterval`).

**Second finding (this session).** A baseline regenerated mid-campaign had
captured an anomalous one-off page state (whole-page difference from every
fresh run). Diffing fresh runs against the **committed HEAD baseline**
showed fresh correct runs match it within 0.76% (< the 2% threshold). The
bad regeneration was therefore discarded (`git checkout` of the baseline)
rather than trusted; three consecutive full-spec runs (3/3 each) confirm
stability.

**Consequence.** Deterministic procedure: banner settled → clock frozen →
screenshot. The committed baseline at `e2e/trail-a11y.spec.ts-snapshots/`
remains the reference; regeneration should only be done when the app's
visual design intentionally changes.

## D07 — No new runtime dependencies; engines stay pure

**Decision.** All new C04 code is pure TypeScript with zero new runtime
dependencies: no date/time/random inside engines (callers supply
timestamps), no DOM access, hash routing retained, localStorage behind the
existing storage interface.

**Rationale.** Repo AGENTS.md trail/lab conventions + engine purity is what
makes replay proofs (T04) possible at all.

**Consequence.** Every determinism claim is testable in Node (vitest) —
byte-stable serialization and replay proofs are unit tests, not manual
claims.

## D08 — Manual screen-reader testing recorded as NOT YET RUN

**Decision.** The automated a11y suite (browser-level keyboard, accessible
names, ariaSnapshot, label-not-color) is verified and integrated in phase A.
Real assistive-technology testing (NVDA/VoiceOver/JAWS/Narrator) is
documented as a precise manual protocol with expected announcements, and
its run log honestly says **NOT YET RUN**.

**Rationale.** A DOM assertion is not a screen-reader test. Pretending
otherwise would violate the campaign's core honesty rule.

**Consequence.** T01 is VERIFIED for its actual deliverables (executable
a11y tests + protocol + honest distinction); the outstanding manual
execution is tracked in `known-limitations.md` as the campaign's top
follow-up.

## D09 — Intent tab becomes step 1 of the lab journey

**Decision.** The lab router gained an `intent` tab ("1. Intent") as the
first tab, hosting the structured intent form → compile → review → adopt
flow. Adoption sets the working architecture (samples preserved; the
default DocFlow reference remains available).

**Rationale.** The campaign's UX standard demands the journey start with
"Intent — what am I trying to build?", and the compiled starter model
needed a real integration point, not a dead-end screen.

**Consequence.** The journey is: Intent → Model (Overview) → … → Evidence
(Capstone). Covered by three new e2e tests and the a11y intent-form test.

## D10 — Capstone: v1 benchmark chip retained, v2 report integrated

**Decision.** The Capstone panel renders the benchmark v2 report
(per-dimension results with limitations + reproduction metadata) and the
evidence pack (capture, integrity check, kind summary, deterministic JSON
export). The C03 benchmark v1 chip remains in the header (still a supported
capability), so nothing was removed.

**Rationale.** Progressive disclosure and evidence-first reporting; the
v1→v2 transition is visible and honest rather than a silent replacement.

**Consequence.** e2e covers both the evidence-pack export (with typed
provenance) and the capstone lifecycle.
