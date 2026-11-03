# Campaign 05 — External Grounding Registry (human-readable mirror)

Machine ground truth: `apps/web/src/lab/engines/sources.ts` (sources),
`engines/claims.ts` (claims), `engines/cases.ts` (cases). Registry
invariants are enforced by tests (`c05-grounding.test.ts`): no fabricated
citations, no dangling references, no falsely grounded claims. This document
mirrors the registry for human review. Access date for all sources:
2026-11-03.

## Sources (19 registered)

| id | source | author/publisher | date | topics |
|---|---|---|---|---|
| src-rfc9110 | HTTP Semantics (RFC 9110) | IETF (Fielding, Nottingham, Reschke) | 2022-06 | caching, conditional requests, Retry-After |
| src-rfc6585 | Additional HTTP Status Codes (RFC 6585) | IETF (Nottingham, Fielding) | 2012-04 | overload, 429 throttling |
| src-little1961 | A Proof of the Queueing Formula L = λW | J. D. C. Little, Operations Research | 1961 | queueing, capacity |
| src-tailatscale | The Tail at Scale | Dean & Barroso, CACM 56(2) | 2013 | latency, tail latency, fanout |
| src-awstimeouts | Timeouts, retries, and backoff with jitter | AWS Builders' Library | 2020 | retries, overload, backoff, timeouts |
| src-releaseit | Release It! (2nd ed.) | Michael T. Nygard, Pragmatic Bookshelf | 2018 | circuit breakers, bulkheads, redundancy |
| src-srebook | Site Reliability Engineering | Beyer et al. (Google), O'Reilly | 2016 | SLOs, error budgets, monitoring |
| src-gilbertlynch2002 | Brewer's Conjecture and the Feasibility of… | Gilbert & Lynch, ACM SIGACT News | 2002 | CAP, consistency |
| src-brewer2012 | CAP Twelve Years Later | E. Brewer, IEEE Computer | 2012 | consistency, partitions |
| src-dynamo2007 | Dynamo: Amazon's Highly Available Key-value Store | DeCandia et al., ACM SOSP | 2007 | availability, reconciliation, quorums |
| src-sagas1987 | Sagas | Garcia-Molina & Salem, ACM SIGMOD | 1987 | sagas, compensation |
| src-stripe-idem | Idempotency keys (API reference) | Stripe, Inc. | 2017– (living docs) | idempotency, retries |
| src-ietf-idem | Idempotency-Key HTTP header (IETF HTTPAPI draft) | IETF HTTPAPI WG (J. Zhou, ed.) | 2023 (draft) | idempotency, API design |
| src-reactive-manifesto | The Reactive Manifesto — glossary: backpressure | Reactive Manifesto contributors | 2014 | backpressure, overload |
| src-nist-ztnull | Zero Trust Architecture (NIST SP 800-207) | NIST (Rose et al.) | 2020-08 | security, trust boundaries |
| src-owasp-top10 | OWASP Top 10:2021 | OWASP Foundation | 2021 | access control, logging |
| src-awssaas | SaaS Lens — Tenant isolation | AWS Well-Architected | 2021– (living) | multi-tenancy, isolation |
| src-otel | OpenTelemetry: Traces / W3C Trace Context | CNCF / W3C | 2021– (living spec) | traces, correlation |
| src-chaoseng2016 | Chaos Engineering | Basiri et al., IEEE Software 33(3) | 2016 | chaos, resilience |
| src-gdpr | GDPR (EU) 2016/679, Art. 5 | European Union | 2016 | privacy, minimisation, retention |

Each entry in `sources.ts` additionally records a Datanova-authored note,
the exact section reference, attribution/licensing, and known limitations.

## Claim-to-source map (24 claims)

**Externally grounded (19):**

| claim | statement (short) | sources |
|---|---|---|
| claim-retry-storms | Retries without limits/backoff/jitter amplify overload | src-awstimeouts |
| claim-timeouts-required | Every sync call needs an explicit timeout | src-releaseit, src-awstimeouts |
| claim-tail-fanout | Fanout latency approaches the slowest backend's tail | src-tailatscale |
| claim-littles-law | L = λW | src-little1961 |
| claim-backpressure | Unbounded queues hide overload; bounds make it visible | src-reactive-manifesto, src-awstimeouts |
| claim-spof-redundancy | Critical-path component without redundancy/buffer = SPOF | src-releaseit, src-srebook |
| claim-idempotency-keys | Payload-bound idempotency keys make retries safe | src-stripe-idem, src-ietf-idem |
| claim-cap-partition | Partition forces availability-vs-atomic-consistency choice | src-gilbertlynch2002, src-brewer2012 |
| claim-dynamo-availability | Dynamo chose availability over cart consistency | src-dynamo2007 |
| claim-saga-compensation | Sagas undo partial executions via reverse compensations | src-sagas1987 |
| claim-slo-error-budgets | Error budgets steer reliability work | src-srebook |
| claim-zero-trust | No implicit trust from network location | src-nist-ztnull |
| claim-access-control-rank | Broken access control is the top appsec risk | src-owasp-top10 |
| claim-tenant-isolation-spectrum | Isolation is an explicit pooled/bridged/siloed decision | src-awssaas |
| claim-trace-model | Traces are spans with propagated context | src-otel |
| claim-chaos-principles | Controlled fault injection with hypothesis + blast radius | src-chaoseng2016 |
| claim-cache-staleness | Cached responses require explicit freshness info | src-rfc9110 |
| claim-429-throttling | 429 + Retry-After is the throttling signal | src-rfc6585 |
| claim-data-minimisation | Shared data must be minimised and retention-bounded (GDPR Art. 5) | src-gdpr |

**Honestly internal (5) — never presented as external:**

| claim | statement (short) | classification |
|---|---|---|
| claim-complexity-needs-requirement | Unmapped components are unjustified complexity | heuristic (normative stance, no citation) |
| claim-queue-model-mms | Queue estimates use a deterministic utilization approximation | simplification (Little's law cited for the invariant) |
| claim-genome-fingerprint | Trait fingerprints usefully summarize architectures | assumption |
| claim-causal-rules | The lab's causal rules describe modeled failure chains | assumption (inspired by documented failure modes) |

**Remaining unsupported/uncertain:** the magnitudes in the causal rules, the
queueing approximation constants, and the genome trait weighting are
Datanova modeling choices, not externally validated facts — labeled as such
in every grounded explanation (UI: "Beyond the sources" deltas).

## Grounded case library (8 cases)

`engines/cases.ts` — every case separates source `facts` from Datanova
`adaptations` (validation enforces both):

| case | dimension | facts → sources |
|---|---|---|
| case-dynamo-cart | consistency | src-dynamo2007, src-gilbertlynch2002 |
| case-retry-storm | overload | src-awstimeouts, src-rfc6585 |
| case-tail-latency | latency | src-tailatscale |
| case-saga-compensation | workflows | src-sagas1987 |
| case-tenant-leak | tenant-isolation | src-awssaas, src-owasp-top10 |
| case-zero-trust-crossing | security | src-nist-ztnull |
| case-chaos-blast-radius | recovery | src-chaoseng2016 |
| case-slo-budget-policy | availability | src-srebook |

## Honesty notes

- The IETF idempotency source is a **draft**, cited with that status.
- "Living documentation" sources (Stripe, AWS, OpenTelemetry) are dated as
  accessed (2026-11-03) since they change over time.
- A source being registered proves the reference is real and read; it does
  NOT constitute independent review of the lab's use of it (that is the
  T12 review protocol, `PROTOCOL READY — NOT EXECUTED`).
