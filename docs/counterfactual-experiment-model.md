# Counterfactual Experiment Model (Campaign 03, Task 08)

**Implementation:** `engines/counterfactual.ts`, mutation operators in
`engines/mutations.ts`; tests in `__tests__/m2.test.ts`.

An experiment compares a **baseline** and a **modified** architecture under the
SAME scenario:

1. **Controlled variable isolation:** the genome diff between baseline and
   modified is computed; traits not listed in `declaredChanges` are reported as
   UNCONTROLLED and the explanation says so explicitly — conclusions about the
   declared change alone are not supported then.
2. **Outcome comparison:** modeled metrics (sync depth, critical-path latency,
   idempotency gaps, worst stateful-failure impact, queue count) are computed
   for both sides from the canonical model.
3. **Attribution:** each metric delta is attributed to the changed genome trait
   when one exists; otherwise the explanation states that attribution is
   uncertain.
4. **Reproducibility:** `runExperiment` is a pure function — identical inputs
   produce identical outputs (tested by running twice).
5. **Uncertainties:** every outcome lists what is modeled vs unknown (queueing
   delay, jitter, and warmup are excluded by design).

Mutations (add queue, add cache, sync→async, add idempotency, retry policy,
split service) check preconditions, refuse invalid states, return a NEW model
(the original is never mutated), and carry a full explanation: original problem,
structural change, expected benefit, and the new trade-offs. `mutationRegressions`
proves unrelated requirements and existing protections survive the mutation.
