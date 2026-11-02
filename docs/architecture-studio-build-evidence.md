# Architecture Studio — Build Evidence

## Reproduce

```bash
cd apps/web
npm ci
npm run test            # vitest: 198 tests
npm run build           # tsc -b && vite build
npx oxlint              # 0 findings
npx vite preview --port 4173 &                      # production build
PW_CHROMIUM_PATH=/path/to/chromium npx playwright test e2e/studio.spec.ts   # 11 tests
STUDIO_EVIDENCE=1 PW_CHROMIUM_PATH=/path/to/chromium npx playwright test e2e/studio-evidence.spec.ts   # regenerates screenshots
```

Repository gates (unchanged code): `python -m pytest tests/` (141), `python -m pytest tests/release/` (12), `python -m ruff check .`;
`python -m mypy …` reports one pre-existing error (see the test report).

## Build output (from the final `npm run build`)

```
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-CwnR7PqA.css   39.60 kB │ gzip:   7.84 kB
dist/assets/index-7J46AUbJ.js   785.71 kB │ gzip: 226.83 kB
✓ built in 1.99s
```

Before Campaign 02 the JS bundle was 499.60 kB (143.39 kB gzip) and CSS 33.46 kB. The Studio therefore adds about 286 kB JS
(83 kB gzip) — scenarios, rules and the simulation engines are bundled with the app, with no new dependency. Vite prints its
standard "chunks larger than 500 kB" notice; code splitting is listed as remaining work in the plan.

## Screenshots (`docs/studio-evidence/`, dark theme, 1440×900; the last is 375×812)

Captured by `e2e/studio-evidence.spec.ts` from the running production build — not mock-ups.

| File | Shows |
|---|---|
| `01-scenarios.png` | Scenario library (5 scenarios), saved architectures, import |
| `02-design-canvas.png` | Design workspace: component palette, canvas with the naive first draft, properties inspector, findings link |
| `03-requirements-map.png` | Requirement → decision → concept → reason → trade-off; evidence checklist; mark addressed / record concern |
| `04-validation.png` | Findings with severity, explanation, options and trade-offs, context note |
| `05-capacity.png` | Capacity inputs, overload warnings, utilization meters (label + number + status) |
| `06-failure-lab-unprotected.png` | External API timeout against an unprotected design: failed nodes (label + icon), flagged path, *User-visible failure* |
| `07-compare.png` | Naive draft vs worked example, side by side |
| `08-review.png` | Ten-category review |
| `09-challenge.png` | Guided challenge for the Payment and Rewards scenario |
| `10-mobile-design.png` | 375 px layout with the compact view switcher |

## Main user journeys covered by passing browser tests

1. Scenario → requirements → design → connect → configure → validate → inject failure → improve → compare → ADR → save → reload → export (test 1).
2. Guided challenge from blank canvas to completion summary and report (test 2).
3. Save / rename / duplicate / export / import (valid and invalid) / delete (test 3).
4. Canvas editing by pointer and keyboard, undo, reset (test 4).
5. Capacity exploration (test 5), motion preferences (tests 6–7), accessibility sweep (test 8), mobile (test 11).
