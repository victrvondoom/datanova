# System Design Trail — Test Report

**Date:** 2026-10-31 · **Location:** `apps/web`

All results below are from actual executions on this machine; commands are
listed so every result is reproducible.

## 1. Unit + content tests — `npx vitest run` (59 tests)

```
Test Files  3 passed (3)
     Tests  59 passed (59)
```

| Suite | File | Tests | Covers |
|-------|------|-------|--------|
| Content | `src/trail/__tests__/content.test.ts` | 14 | exactly 20 topics; sequential unique numbering 1..20; no duplicates; 5 stages with the handbook's topic placement (entry=1, routing=2-5, execution=6-9, reliability=10-14, async=15-20); every topic has problem/explanation/analogy/technical/walkthrough(≥4)/failure/tradeoffs/takeaway/quiz; every quiz answer index valid; prev/next resolvable; topic hrefs well-formed; 22 required glossary terms, unique, defined, linked to valid topics; the handbook's 5 original final-quiz questions; hash router parsing incl. `#/trail/topic/21` → landing |
| Simulations | `src/trail/__tests__/sims.test.ts` | 38 | token consumption + refill + 429 with retry-after; cache miss→hit, stale-after-DB-update, TTL expiry, force refresh; round-robin distribution, unhealthy-node ejection, 503 when all dead; gateway 200/401/429/503/502 with reached-service semantics; CI deploy / deploy-skipped on failing test / build failure; image-vs-container lifecycle, no-run-without-image; kube crash → reconcile → desired state restored, scale up/down, bounds; stale direct-IP fail vs service-name resolve; breaker opens at threshold, fast-fails without calling downstream, half-opens after cooldown, closes on success; timeout success vs bounded fast-fail at the deadline; retryable 5xx/network vs never 4xx, max-attempt stop; exponential delays 1s/2s/4s/8s with bounded ±25% jitter; synchronized vs decorrelated retry waves; idempotent single-charge vs double-charge without key; queue processing, retry-to-DLQ after 3 failures, no processing without workers; pub/sub broadcast + offline backlog + drain on recovery; EDA trace-id propagation + event-sourced balance fold (50−10+60=100); 2PC commit/abort/partial-failure with locked rows; saga forward completion + backward compensation on ship failure; cron duplicate execution without lock vs single execution with lock; UTC→NY hour conversion incl. DST |
| Progress | `src/trail/__tests__/progress.test.ts` | 7 | fresh visitor empty; corrupted storage recovered; visiting ≠ completing; completion requires sim interaction AND correct quiz; storage round-trip persistence; reset clears storage AND state; no duplicate completions |

## 2. Production build — `npm run build`

```
tsc -b  → 0 type errors
vite build → ✓ built in 1.52s   (production bundle)
```

## 3. Lint — `npx oxlint src/trail`

```
Found 1 warning and 0 errors.
```

The single warning is `react(set-state-in-effect` in `TrailApp.tsx` — the
route-driven visit recorder (functional, idempotent setState inside an
effect that fires only on route changes). Accepted deliberately and
documented in the implementation plan; not suppressed.

## 4. E2E user flows — `npx playwright test e2e/trail.spec.ts` (4 tests)

Run against the production build served by `vite preview` on :4173:

```
✓ trail home shows branding, mission, and progress
✓ full learning flow: simulate + quiz completes topic 01, progress persists, reset works
✓ final quiz: all five handbook questions answerable and scoreable
✓ no console errors and no dead navigation on a sample topic
```

The full-learning-flow test walks the exact required journey: open trail →
start Topic 01 → interact with the token-bucket simulation → answer the
knowledge check → completion recorded only after both conditions →
navigate to Topic 02 → glossary search ("jitter" filters; "22 of 22
entries" when cleared) → case study start + step → **reload** → progress
persisted (1/20 complete, Continue button present) → reset with
confirmation → progress actually cleared.

The no-console-errors test fails on any `pageerror` (uncaught JS exception)
while navigating all five stage tabs and deep-linking to
`#/trail/topic/20`.

## 5. Responsive & accessibility verification

- Mobile screenshot at 390×844 (Topic 01):
  `docs/trail-evidence/06-mobile-topic01.png` — controls reachable, no
  horizontal overflow of content (diagram rows wrap).
- All interactive elements are native buttons/selects/inputs with accessible
  names; `focus-visible` rings are defined on the shared `Button` primitive
  and applied via Tailwind `focus-visible:ring-2`.
- System states render label + icon + color (never color alone).
- Diagram bars carry `role="img"`/`aria-label` or `title` descriptions.

## 6. Evidence

Six screenshots under `docs/trail-evidence/`:
landing, topic 01 (token bucket after a 150-request flood, 429s visible),
architecture journey, topic 14 (idempotency ledger), case study (step
playback), and the mobile viewport.

## 7. What is NOT tested (honestly)

- The pre-existing AEGIS E2E (`e2e/journey.spec.ts`) needs the live FastAPI
  backend and was not part of this trail campaign; the trail spec is fully
  backend-independent.
- No visual-regression screenshots diffing (single-capture evidence only).
- `prefers-reduced-motion` behavior is implemented via CSS-transition-only
  animation but not asserted in an automated test.
