# System Design Trail — Architecture & Integration Notes

## Context

The AEGIS-Fraud X repository ships a React 19 + Vite 8 + Tailwind 3
dashboard (`apps/web`) that visualizes a fraud-detection platform, plus a
FastAPI backend (`apps/api`). The TRACEN Vibe Coding Trail was added INTO
this existing application as a new view — no framework, router library, or
backend was introduced.

## Runtime architecture of the trail

```
App.tsx (existing state-based view switcher)
  └─ currentView === "trail" ──▶ <TrailApp/>  (apps/web/src/trail/TrailApp.tsx)
        ├─ useTrailRoute()      hash routes: #/trail, #/trail/topic/01, #/trail/journey,
        │                       #/trail/glossary, #/trail/quiz, #/trail/case-study
        ├─ progress store       localStorage("tracen-trail-progress-v1"), storage-injected
        ├─ Views: Landing / Journey / TopicPage / Glossary / Quiz / CaseStudy
        └─ sims/registry.tsx    topic id → simulation component
                └─ sims/logic.ts  pure, deterministic, unit-tested state machines
```

## Design decisions

1. **Pure logic / thin components.** Every simulation's behavior lives in
   `sims/logic.ts` as pure functions (token bucket, cache-aside steps, LB
   routing, pipeline gating, kube reconciliation, breaker states, timeout
   math, retry policy, backoff+jitter, idempotent charge ledger, queue/DLQ,
   pub/sub fan-out, EDA tracing + event-sourced fold, 2PC outcomes, saga
   compensation, cron duplicate prevention). Components only render state
   and dispatch actions. Consequences:
   - behavior is testable headlessly (59 vitest tests);
   - no duplicated simulation implementations between tests and UI;
   - the case study reuses `backoffDelay` rather than re-implementing it.
2. **Hash routing, not react-router.** The host app has no router; a
   ~100-line hash router keeps deep links (`#/trail/topic/14`) shareable
   and refresh-safe with zero new dependencies.
3. **Completion ≠ visit.** Topic completion requires simulation interaction
   AND a correct knowledge-check answer (see `progress.ts::completeTopic`).
   Opening a page never awards completion.
4. **Honest visual states.** `StateBadge` always renders label + icon +
   color (never color alone): Healthy ✓, Processing ⟳, Waiting …, Failed ✗,
   Retrying ↻, Blocked ⛔, Degraded ⚠, Recovered ✔, Idle ○. The case study
   carries an explicit "this is a simulation, not a load test" disclaimer.
5. **Accessibility.** All controls are real `<button>`/`<select>`/`<input>`
   elements with accessible names; `focus-visible` rings on every
   interactive primitive; `role="log"` for simulation logs; `aria-label`s
   on diagrammatic bars; screen-reader text on the bucket gauge. Animations
   are CSS transitions only (respect `prefers-reduced-motion` via
   transition-property reduction at the app level).
6. **Production-nuance separation.** Handbook text is rendered verbatim;
   production nuances appear only in distinct violet "Production nuance" /
   amber warning callouts (see `docs/content-accuracy-review.md`).

## Integration points (host app)

- `src/components/Sidebar.tsx`: `ViewType` gained `"trail"`; nav item with
  the `GraduationCap` icon.
- `src/App.tsx`: one render line
  (`{currentView === "trail" && <TrailApp />}`) — no other view touched.
- `package.json` (apps/web): added `vitest` devDependency and
  `test`/`test:watch` scripts. No runtime dependency was added; the trail
  is fully functional offline.
- `vitest.config.ts`: scopes unit tests to `src/**/*.test.ts(x)` so the
  Playwright specs in `e2e/` are not collected by vitest.

## Testing architecture

| Layer | Tool | What it proves |
|-------|------|----------------|
| Content | vitest (`__tests__/content.test.ts`) | exactly 20 topics, sequential unique numbering, 5 stages per the handbook layout, all 13 required sections per topic, valid prev/next hrefs, 22 unique glossary terms linked to valid topics, the 5 original final-quiz questions, hash-router parsing incl. invalid ids |
| Simulation behavior | vitest (`__tests__/sims.test.ts`) | the actual taught behavior of all 19 simulated mechanisms (see matrix in the implementation plan) |
| Progress | vitest (`__tests__/progress.test.ts`) | visit ≠ complete, completion gating, storage round-trip, corruption recovery, reset actually clears |
| User flows | Playwright (`e2e/trail.spec.ts`) | trail home; full flow (open → simulate → quiz → complete → navigate → glossary search → case study step → reload persistence → confirmed reset); final quiz scoring; console-error-free navigation across stages + direct URL deep link |

Run commands:

```bash
cd apps/web
npm run test          # vitest run  (59 tests)
npm run build         # tsc -b && vite build
npx vite preview --port 4173 &
npx playwright test e2e/trail.spec.ts   # 4 E2E tests against the production build
```
