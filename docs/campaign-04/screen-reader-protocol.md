# Manual Screen-Reader Test Protocol (Campaign 04, Task 01)

**Scope:** the Architecture Intelligence Lab (`#/lab/...`) in `apps/web`.
**Status of automated coverage:** `e2e/lab-a11y.spec.ts` covers keyboard
operation, accessible names, label+icon+color badges, form labels, the canvas
text alternative, and accessibility-tree snapshots. Those are BROWSER-LEVEL
checks. They are **not** a substitute for testing with real assistive
technology: screen readers synthesize speech/braille from the accessibility
tree with their own heuristics, virtual cursors, and announcement behavior
that no DOM assertion can verify. This protocol is the manual gap, honestly
tracked as manual-only coverage.

## Supported combinations to test

| Priority | Screen reader | Browser | Notes |
|---|---|---|---|
| P1 | NVDA (latest) | Chromium | primary desktop combination |
| P1 | VoiceOver | Safari (macOS) | announced landmarks + rotor navigation |
| P2 | JAWS | Chromium | commercial fallback |
| P2 | Narrator | Edge | Windows default |

## Protocol

For each combination, walk the lab journey below. Record for every step:
what was announced when the view loaded, what the focused control announced
(name, role, value, state), whether the announced order matched the visual
order, and any unlabeled or misleading announcement. File each defect as an
issue with the exact announcement transcript.

1. **Entry.** Navigate to `#/lab` from the dashboard sidebar. Expected: the
   page heading "Architecture Intelligence Lab" is announced; the tab list is
   reachable with Tab and announced as buttons with their labels
   ("1. Intent", "Architecture & Intent", …).
2. **Intent authoring.** On `#/lab/intent`, Tab through every field. Expected:
   each input announces its label ("Peak requests per second", "Acknowledgement
   deadline in milliseconds", …) and its current value; the checkbox announces
   "Require strict read-after-write for results, checked/not checked". Activate
   "Compile and review intent". Expected: the review section is announced (new
   content is reachable); problems read out with their kind
   ("contradictory", "incomplete") and text; unresolved items are announced as
   list items.
3. **Canvas overview.** On `#/lab/overview`, reach the architecture canvas.
   Expected: it is announced as an image with its text alternative ("Architecture
   canvas: N components across M trust zones"); the component explanation
   buttons announce their names.
4. **Causality.** On `#/lab/causality`, operate "Failed component:" and
   "Fault:" with the keyboard. Expected: select announcements include the
   selected option; after changing the target, the causal findings list is
   reachable and each finding announces "Critical/Warning" + title (severity
   is text, not just color).
5. **Findings and evidence kinds.** On `#/lab/review`, read the critic
   findings. Expected: each finding announces severity ("Critical") and the
   evidence-kind chip ("inferred" / "simulated"), then the title.
6. **Scenario runner.** On `#/lab/experiments`, run a scenario. Expected: the
   metrics are reachable in DOM order; expectation results announce
   "[pass]/[fail]" textually; the recovery timeline lines are read as text.
7. **Forms and reset.** Everywhere: every control announces a name; the Reset
   button announces its accessible name ("Reset the lab to the default
   architecture").

## Passing criteria

A combination passes when every step's announcements match the expected
behavior above with no unlabeled controls and no misleading announcements.
Record the tested combination, versions, date, result, and transcripts in this
file's "Run log" section below.

## Run log

| Date | Combination | Result | Notes |
|---|---|---|---|
| — | — | NOT YET RUN | manual assistive-technology testing outstanding (honest gap) |
