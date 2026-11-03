# Architecture Flight Recorder (Campaign 03, Task 28)

**Implementation:** `engines/flightrecorder.ts`; replay UI in
`panels/Experiments.tsx`; tests in `__tests__/m6, m7.test.ts` and
`e2e/lab.spec.ts`.

- **Event model:** append-only `RecordedEvent` log (fault, status-change,
  queue-depth, retry, decision, recovery, alert) with monotonic sequence,
  logical time, and causal provenance: `ruleId`, `cause`, `experimentId`.
- **Recording:** `record` is pure — it returns a NEW recording; history is
  immutable. `recordFromPropagation` imports a causal-propagation run with all
  rule links intact.
- **Replay:** `stateAt(recording, seq)` folds the log deterministically; the
  modeled state at any point is reproducible, and "up -> down" transitions fold
  to the FINAL state. `windowEvents` powers the timeline UI (play/step/skip/
  reset via a slider + buttons).
- **Integrity:** recordings referencing unknown components are flagged
  (`integrityIssues`) and never crash replay; sequence ordering is verified.
- **Orchestration (T33):** fault plans run ordered/dependent steps with
  duration-based recovery events; abort marks later steps skipped (no fault
  executes after abort); pause withholds later steps; the state machine
  (prepared/running/paused/stopped/completed/failed/reset) rejects illegal
  transitions.
