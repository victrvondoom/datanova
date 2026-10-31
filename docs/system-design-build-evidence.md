# System Design Trail — Build Evidence

Exact commands and outputs from the implementation session (2026-10-31),
run from `apps/web` unless noted. Every claim in the test report
reproduces from here.

## 1. Unit / content / progress tests

```
$ cd apps/web
$ npx vitest run

 Test Files  3 passed (3)
      Tests  59 passed (59)
   Start at  18:14:36
   Duration  701ms
```

(Also wired as `npm run test` / `npm run test:watch`.)

## 2. Type-checked production build

```
$ npm run build

> web@0.0.0 build
> tsc -b && vite build

✓ built in 1.52s
```

`tsc -b` type-checks every file under `src/` including the trail —
zero type errors.

## 3. Lint

```
$ npx oxlint src/trail
Found 1 warning and 0 errors.
Finished in 35ms on 17 files with 116 rules using 12 threads.
```

The 1 warning is documented in the implementation plan (deliberate,
benign, not suppressed).

## 4. End-to-end (Playwright, against the production build)

```
$ npx vite preview --port 4173 &     # serves the dist/ build from step 2
$ npx playwright test e2e/trail.spec.ts

  ✓  1 [trail.spec.ts:20:1] trail home shows branding, mission, and progress
  ✓  2 [trail.spec.ts:27:1] full learning flow: simulate + quiz completes topic 01,
        progress persists, reset works
  ✓  3 [trail.spec.ts:96:1] final quiz: all five handbook questions answerable and scoreable
  ✓  4 [trail.spec.ts:116:1] no console errors and no dead navigation on a sample topic

  4 passed (5.5s)
```

## 5. Screenshot evidence (`docs/trail-evidence/`)

| File | What it shows |
|------|---------------|
| `01-trail-landing.png` | Landing: TRACEN branding, mission, 5-stage journey, progress 0%, topic navigator (1440×900) |
| `02-topic01-token-bucket.png` | Topic 01 live simulation after a 150-request bot flood: accepted/rejected counters, 429 rejections, bucket fill bar, gateway diagram |
| `03-architecture-journey.png` | Interactive architecture journey map with stage tabs and clickable nodes |
| `04-topic14-idempotency.png` | Topic 14 idempotency simulation: ledger entries, balance, idempotency key |
| `05-case-study.png` | End-to-end case study during step playback with metrics (cache hits/misses, queue depth, retries) |
| `06-mobile-topic01.png` | Mobile viewport 390×844: controls usable, wrapped layout, no horizontal overflow |

## 6. Backend suite unaffected

The trail is frontend-only; the Python quality gates still hold from the
M3 campaign (141/141 pytest, mypy clean, ruff clean — recorded in
`EVIDENCE.md`). No backend file was modified by this campaign.

## 7. Dependency delta

- Added devDependency: `vitest` (test runner; no runtime dependency added).
- Added scripts: `test`, `test:watch`.
- Added config: `vitest.config.ts` (scopes collection to `src/**` so the
  Playwright specs in `e2e/` are not picked up by vitest).
- No other application dependency, router, state manager, or backend was
  introduced.
