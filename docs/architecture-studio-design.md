# Architecture Studio — Design

TRACEN **Architecture Studio** (Campaign 02) extends the TRACEN Vibe Coding Trail from *knowing* the 20 Foundations
topics to *applying* them: pick a scenario, design an architecture on an interactive canvas, validate it, break it,
improve it, compare versions, record decisions and export the result.

It is **not** a separate product. It is a sibling hash-routed area of the existing React 19 + Vite + Tailwind dashboard
(`apps/web`), reusing the trail's UI primitives (`StateBadge`, `Button`, `Callout`, `Stat`) and its `#/trail/topic/NN`
pages for every "which topic teaches this" link. No new runtime dependency was added.

## Where it lives

| Surface | Change |
|---|---|
| Sidebar | "Architecture Studio" item (badge shows the real number of saved architectures, or "5 scenarios") |
| Trail nav | "Architecture Studio →" button; Studio header links back to the trail |
| Routing | `#/studio` and `#/studio/<tab>`; tabs: scenarios, design, requirements, validate, capacity, failures, compare, review, decisions, challenge, export (`trail/router.ts`) |
| Host chrome | Below 768px the sidebar is replaced by a compact "View" switcher (rendered only on narrow screens); navbar secondary text collapses. Desktop rendering is unchanged. (Needed for a usable mobile Studio: the original fixed 256px sidebar left 119px of content at 375px.) |

## Code layout (`apps/web/src/studio/`)

Pure, DOM-free, unit-tested logic — the UI only renders state and dispatches these operations:

| File | Responsibility |
|---|---|
| `model.ts` | component catalog (26 kinds, 6 categories, per-kind property schemas), `Architecture` graph, connection rules (`canConnect`), editor operations (add/move/rename/group/setProp/delete/connect/disconnect/label), fingerprint, graph queries |
| `graph.ts` | analysis helpers shared by validation, requirements, failures: effective timeout, payment-like, cron protection, chains/paths, consumers, DLQs, subscribers |
| `scenarios.ts`, `requirements.ts` | 5 scenarios, requirement → decision rows, structural evidence tests |
| `validation.ts` | 32 validation rules (see `architecture-validation-rules.md`) |
| `capacity.ts` | transparent capacity model (see `capacity-model-assumptions.md`) |
| `failures.ts` | 12-failure injection engine + recovery (see `failure-injection-model.md`) |
| `compare.ts`, `review.ts` | side-by-side comparison; 10-category review |
| `adr.ts`, `challenge.ts` | ADR lifecycle/markdown; 11-step gated challenge state machine |
| `store.ts` | workspace persistence, import validation, duplicate/rename/delete |
| `exporters.ts`, `visual.ts` | SVG diagram, specification (MD/JSON), challenge report, secret redaction; shared visual vocabulary |
| `blueprints.ts` | per-scenario naive first draft ("Version A") and one worked example ("Version B") |

React layer: `useStudio.ts` (state, debounced persistence, undo), `StudioApp.tsx` (shell) and one `*View.tsx` per tab,
`Canvas.tsx` (SVG editor), `Inspector.tsx`, `Library.tsx`, `ScenarioPanel.tsx`, `parts.tsx`.

## Canvas

SVG canvas with:

- **Add / select / rename / group / delete** components; **move** by pointer drag or arrow keys (Shift = larger step);
  **Delete** key removes the focused component; **Undo** (24 steps) for structural edits.
- **Connect** by Connect mode (click source, click destination, choose type) **or** by the inspector's "Connect this
  component to…" form (keyboard/screen-reader friendly). Connections can be labelled, selected (click or Enter), and disconnected.
- **Five connection types**, each with a distinct dash pattern *and* a legend entry (never colour alone): synchronous
  request, asynchronous message, event publication, data access, scheduled trigger.
- **Meaningful endpoints** (`canConnect`): no self loops or duplicates; nothing initiates toward a client; data stores are
  passive; data access must end at a store; only a scheduler can trigger on a schedule; async needs a queue/DLQ end; events need a
  topic/bus end; policies are never wired in. The reason for a rejection is shown.
- **Reliability policies** (Timeout, Retry Policy, Circuit Breaker, Health Check) guard a *target component* chosen in the
  inspector, drawn as a dotted red guard line, instead of floating on edges.
- **Groups**: components sharing a group name are boxed together.
- **Zoom / fit / pan**: ± buttons, Fit width, 100%, drag empty space or scroll. Editable canvases auto-fit width on mount;
  read-only canvases (Failure Lab, Compare) fit the whole diagram.
- **Overlays** (Failure Lab): node states with label + icon + colour (Healthy ✓, Failed ✗, Degraded ⚠, Recovered ✔ …), edge
  states, highlighted request path, animated flow when motion is allowed.

## Persistence

`localStorage` key `tracen-studio-v1`, behind an injectable `StudioStorage` interface (no backend; none is required for a
local learning app). Debounced autosave (250 ms) flushed on `beforeunload`/`pagehide`; the **Save** button writes and **reads back**,
and the status line shows the real result (including quota/blocked-storage errors). Per workspace:
scenario, architecture (components with configuration, connections, groups), named versions (compare), compare selection,
ADRs, requirement marks, capacity inputs, failure-injection configuration, challenge progress, last review.

Operations: create from scenario (blank / naive draft / challenge), open, rename, duplicate, delete (two-step
confirmation), export JSON, import JSON, reset challenge (confirmation), reset canvas (confirmation, undoable).

### Import validation

`parseWorkspaceImport` rejects, with specific messages and without loading anything: oversize files (>2 MB), invalid JSON,
wrong `format`/`formatVersion`, unknown scenario, unknown component kind, bad/duplicate ids, non-finite coordinates,
wrongly-typed or out-of-range property values, connections to missing components or of unknown type, connections that violate
the connection rules, and more than 200 components / 500 connections. Unknown property keys are dropped. **Challenge progress
and review results are never trusted from a file** (they are recomputed locally), so a file cannot fake completion.

## Exports

- **Diagram (SVG)**: title, subtitle, groups, labelled components with instance counts, labelled connections with arrowheads
  per type, guard lines, and a legend; `<title>`/`<desc>` for accessibility; all text XML-escaped.
- **Specification (Markdown + JSON)**: scenario, requirements with evidence and learner marks, components with
  configuration, connections, capacity assumptions, ADRs, known risks (validation findings), review summary.
- **ADRs (Markdown)**: the documented ADR template.
- **Challenge report (Markdown)**: initial/final architecture, requirements addressed/unresolved, failure results, ADRs,
  simplicity, topics, **known limitations**. Only available after the challenge is actually completed.
- **Workspace (JSON)**: re-importable backup.

All exports pass through redaction (`redactText/redactProps/redactArchitecture`): property keys that look like secrets
and values that look like API keys, tokens, JWTs, private keys, AWS keys or `password=…` are replaced with `[redacted]`.

## Accessibility and motion

- Every control has an accessible name (verified programmatically on every tab); form fields use `<label>`.
- Canvas nodes and connections are focusable `role="button"` elements with descriptive `aria-label`s; Enter/Space select,
  arrows move, Delete removes, Escape deselects.
- State is conveyed by **label + icon + colour**; severity badges carry text and a symbol; meters expose `role="progressbar"`
  with `aria-valuetext`; errors use `role="alert"`, status messages `role="status"`; the capacity chart has a text alternative.
- `prefers-reduced-motion`: animated request paths are not applied (and the CSS animation is disabled as a second layer).
- Responsive: single column on phones; palette collapsed by default; canvas pans/zooms inside its own box; no page-level
  horizontal overflow at 375px on any tab (asserted by e2e).

## Honest-by-construction rules

- Structural evidence ≠ proof; marks never replace evidence; the UI says so.
- Failure outcomes come from configuration; "Not applicable" is never shown as success.
- Capacity numbers are labelled assumptions; cost figures are relative units, not prices.
- A challenge step advances only when its gate is met by real work; moving boxes does not count as improving; a trivial ADR
  does not count; a comparison of identical designs is refused; padding with components is shown as *unjustified*, never rewarded;
  there is no opaque score.
- The payments scenario states in the UI that all payment behaviour is **simulated**.
