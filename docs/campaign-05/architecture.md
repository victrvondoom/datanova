# Campaign 05 — Architecture & Integration Map (code-grounded)

Baseline: Campaign 04 at `ae6555f` (verified at campaign start: vitest
286/286 → re-verified; tree clean; pushed). Campaign 05 adds one new
capability family (evidence exchange), one grounding family, and one
validity family — all pure TypeScript, zero new dependencies, all behind the
same canonical-model and engine-purity rules.

## New modules and their integration points

| Module (new) | Campaign tasks | Integrates with |
|---|---|---|
| `engines/sources.ts` | T06/T08 | Standalone registry + validation; consumed by claims, cases, dep, benchvalid |
| `engines/claims.ts` | T07 | Consumes sources; consumed by grounding, dep (claimIds), benchvalid |
| `engines/cases.ts` | T09 | Consumes sources; consumed by benchvalid (grounded corpus) |
| `engines/grounding.ts` | T10 | Maps critic findings + engine families → claims → sources; UI: Review panel |
| `engines/counterexamples.ts` | T18 | Runs `critic.ts` against challenge fixtures incl. the flawed-checkout sample |
| `engines/benchvalid.ts` | T11/13/14/16/20 | Consumes benchmark2 (C04), cases, claims, sources, review; UI: Capstone dashboard |
| `engines/review.ts` | T12/15/34 | Standalone review protocol/assessments/consensus/quality |
| `engines/nonvisual.ts` | T03/T04 | Consumes canonical model + causalFindings + compareGenomes; UI: Overview, a11y announcements |
| `engines/dep.ts` | T21-25/37/39 | Consumes model serialization, scenario, evidence (C04), claims/sources; the DEP format |
| `engines/exchange.ts` | T26-33/40 | Consumes dep + model diff; inbox/outbox/annotations/responses/reconciliation/provenance |
| `engines/known-engines.ts` | T13 | Inventory of real engine files (grounded-case sanity check) |
| `panels/Exchange.tsx` | T19/22/26/28/29/30/33/35/38/40 | New "Evidence Exchange" tab; localStorage key `tracen-lab-exchange-v1` |
| `panels/Overview.tsx` | T03 | Nonvisual architecture summary (details/summary) |
| `panels/Review.tsx` | T10 | Grounded explanations section |
| `panels/Capstone.tsx` | T16/20 | Benchmark validity dashboard + external validation status |
| `panels/Intent.tsx` | T04 | Polite live-region announcement on compile |
| `LabApp.tsx` + `router.ts` | T05/19 | ARIA tablist with roving arrow-key focus; exchange route `#/lab/exchange` |
| `components/Navbar.tsx` | a11y defect | Theme toggle accessible name (found by the new a11y scan) |
| `ui.tsx` | T04 + panels | `Announcer` (role=status, polite) + Callout `ok`/`bad` kinds |

## Data flow (the exchange loop)

```
create (Intent/Overview) → buildDepPackage (model + scenario + evidence + claims/sources)
  → privacy scan → export (deterministic canonical JSON + download)
  → [any file-transfer channel] → recipient validateDep (isolated, untrusted)
  → staged preview → receive → inspect → accept (adopts the model) / reject
  → annotate (id-keyed, package never mutated) → buildReviewResponse
  → [channel] → author validateReviewResponse (digest-bound)
  → reconcileResponse (conflicts surfaced, explicit decisions)
  → provenance chain (append-only, digest-linked) visible on both sides
```

Every step is a pure function or an explicit user action; nothing in the
path performs network I/O, and no step can silently overwrite workspace
state.

## Conventions preserved

- **Engine purity:** no DOM/time/random inside engines (timestamps
  caller-supplied; the only `new Date()` is in the Exchange panel's event
  handlers, never during render — oxlint/react-compiler verified).
- **One canonical model:** packages embed `serializeModel()` output and are
  re-validated with `parseModel()` on import; nothing reinterprets it.
- **No new runtime dependencies;** hash and canonical-JSON implemented
  locally (fnv1a-32, documented as corruption detection — not security).
- **localStorage behind injectable storage** (panel-scoped key, same
  pattern as the trail/lab stores).
- **A11y rules:** label+icon+color badges; polite live regions; the tab
  bar is a real ARIA tablist; e2e asserts zero unlabeled controls.

## Migration risks (assessed)

- C04 behaviors untouched: all C03/C04 suites re-run green (371/371 total).
- The lab router gained one tab; `parseLabHash` unchanged in behavior.
- `Callout` gained two kinds — additive, existing callouts unaffected.
- C04 evidence packs (Capstone export) remain as-is; DEP is a new, larger
  format alongside them (both tested).
