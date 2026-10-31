# TRACEN Vibe Coding Trail — Implementation Plan & Milestone Log

**Product:** *System Design Made Visual — TRACEN Vibe Coding Trail, Foundations: First 20 Topics*
**Status:** implemented and verified (see the test report and build evidence).
This document records the plan, the decisions, and the completion matrix.

## Where the trail lives

The trail is a new view (`"trail"`) inside the existing React 19 + Vite +
Tailwind dashboard (`apps/web`), NOT a separate application:

- Sidebar item "Vibe Coding Trail" (`apps/web/src/components/Sidebar.tsx`).
- Mounted in `App.tsx` (`currentView === "trail" && <TrailApp />`).
- Sub-navigation uses hash routes (`#/trail`, `#/trail/topic/01`, …) via a
  ~100-line router in `src/trail/router.ts` — no react-router dependency
  was introduced; the host app's state-based view switching is untouched.

## Architecture (files)

```
apps/web/src/trail/
├── content.ts            # authoritative content model: 20 topics, 5 stages, 22 glossary entries, final quiz
├── progress.ts           # localStorage progress store (storage-injected for tests)
├── router.ts             # hash router + parse/serialize helpers
├── ui.tsx                # shared primitives: StateBadge (label+icon+color), SimCard, Node, Arrow, Stat, Button, Callout, LogView
├── TrailApp.tsx          # shell: nav, progress persistence, reset-with-confirmation
├── Views.tsx             # Landing, Architecture Journey map, Glossary (search), Final quiz
├── TopicPage.tsx         # the 13 required sections per topic + completion gating
├── CaseStudy.tsx         # end-to-end viral PDF SaaS walkthrough (6 steps, injectable failure)
├── sims/
│   ├── logic.ts          # ALL simulation logic as pure, deterministic, unit-tested functions
│   ├── Sims01to05.tsx    # token bucket, cache-aside, load balancer, reverse proxy, API gateway
│   ├── Sims06to10.tsx    # CI/CD, Docker, Kubernetes, service discovery, circuit breaker
│   ├── Sims11to15.tsx    # timeouts, retries, backoff+jitter, idempotency, queue+DLQ
│   ├── Sims16to20.tsx    # pub/sub, EDA, 2PC, saga, cron
│   └── registry.tsx      # topic id -> simulation component
└── __tests__/            # vitest suites (content, sims, progress)
```

**Key separation of concerns:** simulation logic (`logic.ts`) is pure and
deterministic; components are thin presentational wrappers. This is what
makes the behavior testable without a browser, while Playwright E2E covers
the interactive user flows.

## Completion model

A topic is **completed only when BOTH** conditions hold:
1. the learner actually interacted with the simulation (`onInteract`
   recorded), and
2. the topic knowledge check was answered correctly.

Visiting a page never marks it complete (tested explicitly in
`progress.test.ts` and in the E2E flow).

## Milestone checklist (Phases 1–9 from the master prompt)

- [x] Phase 1 — Discovery: React 19 + Vite + Tailwind dashboard; state-based
      views; oxlint; Playwright already present for E2E.
- [x] Phase 2 — Foundation: content model, hash router, progress store,
      shared UI primitives.
- [x] Phase 3 — Topics 01–05 with working simulations.
- [x] Phase 4 — Topics 06–10.
- [x] Phase 5 — Topics 11–15.
- [x] Phase 6 — Topics 16–20.
- [x] Phase 7 — End-to-end PDF SaaS case study (6 steps, inject/restore
      failure, play/pause/step, reset, honest disclaimer).
- [x] Phase 8 — Glossary (22 entries, searchable, topic-linked), final quiz
      (the handbook's 5 original questions), responsive + accessibility pass
      (keyboard focus states, aria labels, label+icon+color states,
      reduced-motion via CSS transitions only, mobile screenshot evidence).
- [x] Phase 9 — Full verification: `tsc -b && vite build`, `vitest run`
      (59 tests), Playwright E2E (4 tests), screenshots, docs.

## 20-topic completion matrix

| # | Topic | Simulated behavior (controls → state) | Logic tests | E2E |
|---|-------|----------------------------------------|-------------|-----|
| 01 | Rate Limiting | token bucket: send/burst/flood/auto-traffic/frequency → tokens, 200 vs 429, refill | ✓ | ✓ |
| 02 | Caching | read/update DB/expire TTL/force refresh → hits, misses, stale version | ✓ | — |
| 03 | Load Balancing | send/spike/kill-restore servers → per-node counts, 503 on all-dead | ✓ | — |
| 04 | Reverse Proxies | path choice + staged walkthrough → TLS/static/backend path | covered by content tests | — |
| 05 | API Gateways | path/JWT/rate/service/gateway-down toggles → routed responses 200/401/429/503/502 | ✓ | — |
| 06 | CI/CD | push + inject failing test/build error → deploy vs deploy-skipped | ✓ | — |
| 07 | Docker | build/run/stop → images vs containers state | ✓ | — |
| 08 | Kubernetes | desired count, crash pod, reconciler → replacement pods | ✓ | — |
| 09 | Service Discovery | restart pod, direct-IP vs service-name calls → stale fail vs resolve | ✓ | — |
| 10 | Circuit Breakers | healthy/overloaded B, calls → closed/open/half-open, fast-fail, degraded store panel | ✓ | — |
| 11 | Timeouts | timeout + response sliders → success vs fast-fail at deadline | ✓ | — |
| 12 | Retries | max attempts, failure type, success-on-attempt → retry vs fail decisions | ✓ | — |
| 13 | Exponential Backoff | jitter on/off, client count → delay sequence, synchronized vs spread waves | ✓ | — |
| 14 | Idempotency | bad/good scenario, key editor → ledger + balance, single vs double charge | ✓ | ✓ (screenshot) |
| 15 | Queues & DLQ | submit jobs, workers, email API down → retries → DLQ after 3 | ✓ | — |
| 16 | Pub/Sub | publish order, toggle subscribers → delivery vs backlog + drain on recovery | ✓ | — |
| 17 | EDA | publish UserCreated/ItemAdded → trace ids, consumers; event-sourcing bank fold | ✓ | — |
| 18 | Distributed Transactions | votes, crash-on-commit → committed/aborted/partial-failure (locked rows) | ✓ | — |
| 19 | Saga Pattern | choreography/orchestration toggle, fail-at step → forward + backward compensation log | ✓ | — |
| 20 | Cron Jobs | lock on/off, queue-first flow, fire schedule → duplicate vs single emails, UTC/NY math | ✓ | — |

(Topic 04's routing behavior is exercised through its interactive stage
walkthrough; its distinct LB-vs-proxy comparison panel is content-verified.)

## Known limitations & follow-ups

1. **oxlint leaves 1 warning** (`set-state-in-effect` in `TrailApp.tsx`):
   the route-driven visit-recording effect intentionally persists progress
   on navigation. Benign; documented rather than suppressed.
2. **Simulation interaction state is session-scoped** (React state, not
   persisted): reloading mid-topic re-arms the "interact" requirement. The
   completion record itself IS persisted. This is a deliberate simplicity
   trade-off, not a data-loss bug.
3. The full AEGIS journey spec (`e2e/journey.spec.ts`) requires the live
   FastAPI backend; the trail spec is backend-independent (works offline).
4. No backend is used by the trail — per the master prompt, no
   backend/database was introduced solely for progress tracking
   (localStorage is the chosen persistence).
