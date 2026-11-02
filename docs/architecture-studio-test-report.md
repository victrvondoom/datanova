# Architecture Studio — Test Report

All results below were produced by commands actually executed in this repository on the branch
`claude/pensive-archimedes-shhh4e`. Nothing is estimated. Reproduce with the commands in each section.

## 1. Unit tests (vitest) — `cd apps/web && npm run test`

**198 tests in 10 files, all passing** (61 pre-existing trail tests + 137 new Studio tests).

| File | Tests | Covers |
|---|---:|---|
| `studio/__tests__/editor.test.ts` | 23 | add / move / rename / group / edit properties / connect / disconnect / delete components; connection rules; fingerprint; **save, reload, duplicate, rename, delete**; **export, import valid, reject invalid** (13 rejection cases: bad JSON, wrong format/version, unknown scenario/kind, duplicate ids, bad coordinates, missing endpoints, unknown connection type, rule-violating connection, wrong property type, oversize, too many components); unknown props dropped; challenge/review never trusted from a file; storage failure reported honestly; SVG title/legend/escaping; secret redaction |
| `studio/__tests__/validation.test.ts` | 27 | every required rule **detected** (missing timeout, unbounded retries, no backoff, payment without idempotency, queue without consumer, queue without failure path, duplicate-cron risk, unclear data ownership, cache without expiry, unhandled critical dependency, unnecessary infrastructure, direct exposure, …) **and** valid designs **not** flagged; finding contract (what/why/affects/topics/options+trade-offs/context); severity ordering; all four severities exist |
| `studio/__tests__/simulation.test.ts` | 35 | capacity model (traffic changes load; cache hit rate changes DB load; worker rate changes queue depth/drain; sanitising; derive-from-architecture; every formula documented) · all **12 failures** (timeouts change outcomes; retry limits respected; breakers change behaviour; idempotency prevents duplicates; DLQ receives poison jobs; unbacked cron lock still duplicates; retention preserves events) · **recovery only with a mechanism** · before/after comparison |
| `studio/__tests__/scenarios.test.ts` | 33 | five scenarios have substance and differ; requirement rows complete; only the existing 20 topics referenced; baselines vs worked examples (more evidence, fewer critical/high findings, no critical in examples); collaboration scenario's real-time rules; comparison dimensions, trade-offs, no "winner"; review's ten categories; ADR create/edit/delete/export |
| `studio/__tests__/challenge.test.ts` | 10 | eleven gated steps; no skipping; moving boxes ≠ improving; trivial ADR rejected; identical-design comparison refused; progressive, capped, non-solving hints; constraint feedback; completion summary contents; padding with components not rewarded |
| `studio/__tests__/useStudio.test.ts` | 4 | state transitions are **pure** (StrictMode-safe), one undo per edit, bounded history |
| `studio/__tests__/docs.test.ts` | 5 | every rule, failure, formula, scenario, component kind and challenge step is documented; the required docs exist |
| `trail/__tests__/{content,progress,sims}.test.ts` | 61 | Campaign 01, unchanged |

## 2. End-to-end (Playwright) — `cd apps/web && npx playwright test e2e/studio.spec.ts`

Run against the production build served by `vite preview --port 4173`, using the pre-installed Chromium
(`PW_CHROMIUM_PATH`, an opt-in setting added to `playwright.config.ts`). **11 passed, 0 failed** (the opt-in
`studio-evidence.spec.ts` is skipped unless `STUDIO_EVIDENCE=1`). An earlier 10-test version of the suite passed three consecutive runs without a flake; the final
11-test suite passed in its final run (it was not repeated three times).

| # | Test | What it proves in a real browser |
|---|---|---|
| 1 | Full journey | Open Studio → 5 scenarios → select → review requirements (0/10 evidenced; decision, reason, trade-off, Topic links) → add 5 components → connect (Connect mode **and** inspector) → an invalid connection is rejected with its reason → configure properties → validation shows an explained, expandable finding → save a version → inject failure (unprotected = *User-visible failure*, protections shown "not active", trace has trigger and final outcome) → restore + recover (*not replayed* — honest) → add a circuit breaker with fallback → re-inject (*Degraded but served*; before/after table marks the change) → compare versions (trade-offs, "simpler architecture" perspective) → record an ADR (an incomplete ADR is rejected) → Save → **reload** (6 components, 4 connections, ADR present) → **export** SVG (title, legend, labels) and specification (components, ADR-001, known risks); no challenge report for unfinished work |
| 2 | Guided challenge | Cannot skip reading; requirements revealed progressively; decoy constraints scored; blank canvas blocks the sketch step; hints capped at 3; ADR required; validation must be *run*; a failure must be *injected*; moving a box is *not* an improvement but a configuration change is; compare then final review; summary lists all required sections; challenge report downloads with limitations; reset needs confirmation |
| 3 | Persistence management | Rename, duplicate, export JSON, import it back, **reject** a tampered file and non-JSON (nothing loaded), delete needs confirmation |
| 4 | Canvas editing | Pointer drag moves a node and persists across reload; a plain click selects without moving; keyboard move; rename; group box; label a connection; disconnect; Delete key; **Undo**; reset needs confirmation; zoom controls |
| 5 | Capacity explorer | Scenario's viral peak is *Overloaded*; changing instances/peak/workers changes status, warnings, bottlenecks and queue behaviour; eight documented formulas shown; inputs persist across reload |
| 6–7 | Motion | With `prefers-reduced-motion: reduce` no animated path is applied; otherwise the request path animates (`animation-name: studio-flow`) |
| 8 | Every tab | All eleven tabs render, exactly one `aria-current=page`, **every button/link/input/select/textarea has an accessible name**, no console or page errors; review generates ten categories and goes stale when the design changes |
| 9 | No workspace | Tabs guide the learner to pick a scenario rather than showing an empty editor |
| 10 | Host integration | Sidebar entry and trail button open the Studio; the Studio links back; a Studio topic link opens `#/trail/topic/01` |
| 11 | Mobile 375 px | **No page-level horizontal overflow on any of the 11 tabs**; canvas fits width, pans inside its own box when zoomed; compact view switcher present; library usable |

Console errors are asserted to be empty in tests 1–4, 8 and 11 (only the host dashboard's own failed fetches to the API, which is
not running during these tests, are ignored).

## 3. Defects found by the tests and fixed (regression-tested)

| Found by | Defect | Fix |
|---|---|---|
| e2e journey | "Before" snapshot for before/after was component state, lost when navigating to Design to make the change | Persisted as a saved version `Failure Lab: before` |
| e2e canvas | Connection click target hidden by the selection ring on 12 px gaps; default grid left ~22 px between nodes | Wider default spacing (72 px gaps), ring is non-interactive; connections also reachable by keyboard (tested) |
| e2e mobile | Host dashboard's fixed 256 px sidebar left 119 px of content at 375 px (page scrolled horizontally) | Responsive host chrome; asserted by test 11 |
| e2e (existing `trail-a11y`) | My first mobile switcher added a hidden "Vibe Coding Trail" `<option>` earlier in the DOM and broke `getByText(...).first()` | Switcher rendered only on narrow screens; existing reduced-motion test passes again |
| unit | Target selection picked the first node in canvas order instead of the failure's preferred kind | `pick` honours `targetKinds` order |
| unit | A run was "failed" if 3/20 requests failed | `FAILED_SHARE = 0.25` threshold, documented |
| unit | No final outcome step in the trace | Added to every applicable run |
| design review | Undo history mutated inside a state updater (double-applied under StrictMode) | History moved into state; pure transitions (`useStudio.test.ts`) |
| `tsc -b` | `docs.test.ts` used `node:fs`, rejected by the app's tsconfig | Uses Vite's typed `import.meta.glob` |

## 4. Static checks

| Check | Command | Result |
|---|---|---|
| Type-check + build | `cd apps/web && npm run build` (`tsc -b && vite build`) | passes |
| Lint | `cd apps/web && npx oxlint` | 0 warnings, 0 errors (exit 0) |

## 5. Backend / repository gates (untouched by this campaign — 0 Python files changed)

Run in a fresh virtualenv (`pip install -e ".[dev]"` plus `cryptography`):

| Gate | Result |
|---|---|
| `python -m pytest tests/ -q -W ignore` | **141 passed** |
| `python -m pytest tests/release/ -v` (mandatory release gates 1 & 2) | **12 passed** |
| `python -m ruff check .` | All checks passed |
| `python -m mypy packages apps scripts --ignore-missing-imports` | **1 error** in `scripts/feature_catalog_data.py:54` (`Need type annotation for "F"`). Reproduced identically on the pre-campaign checkpoint tag, so it is **pre-existing** and not introduced here (current mypy is stricter than the one the repo was last checked with). Not fixed: out of scope. |

Running the Python suite rewrites the tracked `aegis_requirements_audit.txt` with the local package versions; that side
effect was reverted and is not part of this change.

## 6. Not run / known gaps (stated plainly)

- `e2e/journey.spec.ts` (needs a live FastAPI backend) was run and **fails**: its first test requires the backend, and its
  second hits a strict-mode locator collision caused by sidebar text added in an earlier, unrelated commit (`a72221b`). Pre-existing; not changed.
- `e2e/trail-a11y.spec.ts`: the reduced-motion test passes. The two visual-baseline tests have baselines only for `win32`,
  so on Linux they cannot pass until baselines are generated (pre-existing).
- No automated WCAG/axe scan and no screen-reader run (no axe dependency, no network). Accessibility evidence is limited to
  the programmatic checks above, keyboard operation tests and manual review of screenshots.
- Touch dragging was not exercised on a physical touch device.
- No cross-browser run (Chromium only).
