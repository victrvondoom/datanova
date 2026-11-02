# Architecture Studio — Implementation Plan and Milestone Log (Campaign 02)

**Product:** TRACEN Architecture Studio — *from understanding system components to designing systems that survive reality.*
**Branch:** `claude/pensive-archimedes-shhh4e` · **Checkpoint tag before work:** `checkpoint/pre-campaign-02` (commit `a72221b`).

## Phase 1 — Campaign 01 audit (verified, not assumed)

| Check | Result at start of Campaign 02 |
|---|---|
| Trail present in the dashboard (Foundations 01–20, journey, simulations, case study, quiz, glossary, progress) | Present; routes `#/trail/...`; see `system-design-trail-implementation-plan.md` |
| `npm run test` (vitest) | **61 / 61 passed** (content, progress, simulation logic) |
| `npm run build` (`tsc -b && vite build`) | Succeeded |
| `npx oxlint` | 0 findings |
| Documentation (plan, architecture, test report, build evidence, content accuracy review, evidence screenshots) | Present |
| Critical defects found | None. No Campaign 01 code needed fixing before building on it. |

Pre-existing, unrelated issues observed (not caused by this campaign; see "Remaining" below): Playwright visual baselines are
Windows-only; `e2e/journey.spec.ts` needs a live backend and has a strict-mode text collision; `mypy` reports one error in
`scripts/feature_catalog_data.py` on a current mypy; tests need the unlisted `cryptography` package.

## Decisions

1. **Sibling area, not a new app** — `#/studio`, same shell, same primitives, no new dependency (AGENTS.md rule for the trail).
2. **Pure logic first** — every behaviour lives in DOM-free modules with unit tests; components only render.
3. **Structural evidence, not scores** — requirements are "evidenced" by diagram structure; no opaque grading.
4. **Local persistence** — `localStorage` behind an interface; no backend, per the spec's "do not introduce a backend for a small educational workspace".
5. **Policies guard a target** — Timeout/Retry/Breaker/Health Check attach to a component rather than float on edges, so
   validation and the failure engine can reason about them unambiguously.
6. **Worked examples are optional and imperfect** — one example per scenario for Compare; hidden in the guided challenge;
   each still leaves real gaps that the Failure Lab reports.
7. **Responsive host chrome** — minimal changes to the host navbar/sidebar/layout so mobile is genuinely usable.

## Milestones

- [x] Phase 1 — audit, baseline, checkpoint tag
- [x] Phase 2 — foundation: component model (26 kinds), canvas, inspector, properties, save/load
- [x] Phase 3 — scenario system: 5 scenarios, requirement→decision map, evidence tests
- [x] Phase 4 — validation: 32 rules with explanations, options and trade-offs
- [x] Phase 5 — capacity explorer with documented formulas
- [x] Phase 6 — Failure Injection Lab: 12 failures, recovery, before/after
- [x] Phase 7 — comparison, review (10 categories), ADRs
- [x] Phase 8 — guided challenge (11 gated steps, progressive hints, completion summary)
- [x] Phase 9 — exports, responsive, accessibility checks, visual refinement
- [x] Phase 10 — final verification (see `architecture-studio-test-report.md`, `architecture-studio-build-evidence.md`)

## Scenario completion matrix

| Scenario | Id | Requirements | Topics |
|---|---|---|---|
| Viral PDF Generation SaaS | `pdf-saas` | 10 (6 functional / 4 non-functional) | 01, 02, 05, 08, 10, 11, 12, 13, 14, 15, 16, 20 |
| E-Commerce Checkout | `ecommerce-checkout` | 10 (3 functional / 7 non-functional) | 02, 03, 10, 11, 14, 16, 17, 18, 19 |
| Real-Time Collaboration App | `realtime-collab` | 10 (4 functional / 6 non-functional) | 02, 03, 04, 05, 09, 11, 14, 15, 16, 17 |
| Notification and Email Platform | `notification-platform` | 10 (5 functional / 5 non-functional) | 02, 11, 12, 13, 14, 15, 16, 20 |
| Payment and Rewards Platform | `payments-rewards` | 11 (3 functional / 8 non-functional) | 02, 11, 12, 13, 14, 16, 17, 18, 19 |

Each scenario has its own requirements, constraints (plus decoys for the challenge), traffic/consistency/reliability/security/
budget sections, capacity defaults, a naive first draft and a worked example. All five are covered by unit tests
(`scenarios.test.ts`) and the example designs are checked to give structural evidence for (nearly) every requirement while
the naive drafts do not.

## Component catalog (26 kinds)

| Category | Component | Properties | Teaches |
|---|---|---|---|
| Entry and protection | Client (`client`) | Transport | Rate Limiting |
| Entry and protection | CDN / Edge (`cdn`) | Content scope; Edge TTL | Caching, Reverse Proxies |
| Entry and protection | Rate Limiter (`rate_limiter`) | Algorithm; Capacity; Refill rate; Identity key; Enforcement location | Rate Limiting |
| Entry and protection | Reverse Proxy (`reverse_proxy`) | Terminates TLS; Buffers slow clients | Reverse Proxies |
| Entry and protection | Load Balancer (`load_balancer`) | Algorithm; Removes unhealthy instances | Load Balancing, Service Discovery |
| Entry and protection | API Gateway (`api_gateway`) | Validates credentials; Built-in rate limiting; Removes unhealthy upstreams | API Gateways, Rate Limiting |
| Application | Web Application (`web_app`) | Instance count; Outbound request timeout; Observability | Load Balancing, Docker |
| Application | Application Service (`app_service`) | Instance count; Outbound request timeout; Serves; Performs charge / billing-like operations; Health-check endpoint; Observability; Approx. capacity per instance | Load Balancing, Docker, Kubernetes |
| Application | Authentication Service (`auth_service`) | Instance count; Outbound request timeout; Token type; Observability | API Gateways |
| Application | Background Worker (`worker`) | Instance count; Outbound request timeout; Jobs/s per instance; Handler safe to run twice; Autoscales on backlog; Observability | Message Queues & Dead Letter Queues, Timeouts |
| Application | Scheduled Job Runner (`cron_runner`) | Schedule; Instance count; Duplicate-run protection | Cron Jobs |
| Data | PostgreSQL Database (`postgres`) | Owning service; Read/write behavior; Transaction boundary; Backup / recovery assumption; Approx. capacity | Caching |
| Data | Redis Cache (`redis_cache`) | Cache strategy; TTL; Key pattern; Invalidation strategy; Data sensitivity | Caching |
| Data | Object Storage (`object_storage`) | Access; Retention | Caching |
| Data | Idempotency Store (`idempotency_store`) | Key retention; Atomic claim; Stores first result for replay | Idempotency |
| Asynchronous communication | Message Queue (`queue`) | Delivery attempts before giving up; Visibility timeout; Dead-letter policy; Persists messages; Max depth | Message Queues & Dead Letter Queues |
| Asynchronous communication | Dead Letter Queue (`dlq`) | Alerts when non-empty; Retention | Message Queues & Dead Letter Queues |
| Asynchronous communication | Pub/Sub Topic (`pubsub`) | Retains events; Delivery | Pub/Sub |
| Asynchronous communication | Event Bus (`event_bus`) | Retains events; Delivery | Event-Driven Architecture, Pub/Sub |
| Reliability | Circuit Breaker (`circuit_breaker`) | Protects component; Failures before opening; Open duration; Fallback while open | Circuit Breakers |
| Reliability | Timeout (`timeout`) | Protects component; Timeout | Timeouts |
| Reliability | Retry Policy (`retry_policy`) | Protects component; Max attempts; Backoff | Retries, Exponential Backoff |
| Reliability | Health Check (`health_check`) | Protects component; Interval; On failure | Service Discovery, Load Balancing |
| Distributed workflows | Transaction Coordinator (`tx_coordinator`) | Participant timeout; Durable recovery log | Distributed Transactions |
| Distributed workflows | Saga Orchestrator (`saga`) | Style; Compensating actions; Persists workflow state | Saga Pattern |
| Distributed workflows | External Service (`external_service`) | Provider; Criticality; Simulated | Circuit Breakers, Timeouts, Retries |

## Guided challenge — steps and gates

1. **Read the scenario** — gate: Confirm you have read the scenario.
2. **Reveal functional requirements** — gate: Confirm you have read the functional requirements.
3. **Reveal non-functional requirements** — gate: Confirm you have read the non-functional requirements.
4. **Identify constraints** — gate: Select at least one statement and submit.
5. **Sketch the initial architecture** — gate: Canvas has 0 component(s) and 0 connection(s); need ≥ 3 and ≥ 2.
6. **Explain your key decisions** — gate: No ADR has both a decision and a reason of at least 20 characters.
7. **Run architecture validation** — gate: Run validation from the Challenge panel.
8. **Inject a failure** — gate: Run at least one failure in the Failure Lab.
9. **Improve the architecture** — gate: The structure and configuration are unchanged since the failure run (moving components does not count).
10. **Compare initial and final versions** — gate: Open the comparison below.
11. **Generate the final review** — gate: Complete steps 1–10 first.

(Steps 1–3 gate on an explicit acknowledgment; later gates are computed from the learner's real work. See `challenge.ts`.)

## Known limitations and remaining work

| # | Severity | Item | Where |
|---|---|---|---|
| 1 | Medium | No automated WCAG/axe audit or screen-reader pass; accessibility is verified by programmatic checks (accessible names on every tab, keyboard operation, reduced motion, 375px no-overflow) | `e2e/studio.spec.ts` |
| 2 | Medium | Saga / 2PC are validated and reviewed but no failure drives them (no partial-failure saga simulation) | `failures.ts` |
| 3 | Low | Touch dragging uses pointer events (`touch-action: none` on nodes) but was not exercised on a physical touch device | `Canvas.tsx` |
| 4 | Low | Single bundle grew from ~500 kB to ~790 kB; no code splitting (build warns >500 kB) | `vite.config.ts` |
| 5 | Low | Component palette is tall on desktop (collapsible); canvas starts below the fold at 900px height | `Library.tsx`, `DesignView.tsx` |
| 6 | Low | Data lives only in the browser; clearing site data deletes it — use *Export JSON* to back up | by design |
| 7 | Info (pre-existing) | `e2e/journey.spec.ts` needs a live backend and fails strict-mode on duplicated "backend offline" text | `apps/web/e2e/journey.spec.ts`, `Sidebar.tsx` |
| 8 | Info (pre-existing) | Playwright visual baselines exist only for `win32` | `apps/web/e2e/trail-a11y.spec.ts-snapshots/` |
| 9 | Info (pre-existing) | `mypy` error in `scripts/feature_catalog_data.py:54` on current mypy; `cryptography` not declared in `pyproject.toml` | repo root |

## Next highest-value engineering campaign

*Simulated saga and distributed-lock execution in the Failure Lab* (partial failure mid-saga, compensation failing,
lock expiry mid-run) plus shareable read-only links — it would close limitation 2 and turn the scenarios on distributed
workflows (E-Commerce, Payments) from reviewed designs into rehearsed ones.
