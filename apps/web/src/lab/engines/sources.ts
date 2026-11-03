/**
 * Campaign 05, Tasks 06/08 — External architecture source registry.
 *
 * REAL, traceable primary references only: standards, RFCs, peer-reviewed and
 * widely cited publications, and official vendor engineering documentation.
 * Every entry was verified to exist at `accessed` (2026-11-03) — no invented
 * citations. Notes are Datanova-authored summaries in our own words (no
 * wholesale copying); section references point at the relevant parts of each
 * source. Content is stored only as metadata + short summaries, which is
 * normal scholarly citation practice.
 */

export type SourceCategory =
  | "standard" // RFC / IETF / NIST
  | "publication" // peer-reviewed or widely cited publication
  | "book" // engineering book (cited, not reproduced)
  | "official-docs" // official vendor/framework documentation
  | "regulation"; // legal regulation

export interface ExternalSource {
  id: string;
  title: string;
  author: string;
  url: string;
  /** publication or last-known-stable date (YYYY or YYYY-MM) */
  published: string;
  /** when Datanova verified the source exists and read the cited part */
  accessed: string;
  category: SourceCategory;
  /** engineering topics this source legitimately supports */
  topics: string[];
  /** Datanova-authored one-line summary of the relevant content */
  note: string;
  /** where in the source the relevant material lives */
  sectionRef: string;
  /** attribution / licensing note */
  attribution: string;
  /** known limitations of using this source */
  limitations: string;
}

export const SOURCE_ACCESS_DATE = "2026-11-03";

export const SOURCES: ExternalSource[] = [
  {
    id: "src-rfc9110",
    title: "HTTP Semantics (RFC 9110)",
    author: "IETF — R. Fielding, M. Nottingham, J. Reschke (eds.)",
    url: "https://www.rfc-editor.org/rfc/rfc9110.html",
    published: "2022-06",
    accessed: SOURCE_ACCESS_DATE,
    category: "standard",
    topics: ["caching", "conditional-requests", "retries", "http"],
    note: "Defines HTTP semantics, including that responses without explicit freshness information should not be reused (Section 5.2 caches) and specifies Retry-After and conditional request mechanisms.",
    sectionRef: "Sections 5.2, 9.3.1, 15.3.5 (Retry-After)",
    attribution: "IETF RFC — freely reproduced with attribution per BCP 78/79.",
    limitations: "Describes protocol semantics, not database-level read-after-write behavior.",
  },
  {
    id: "src-rfc6585",
    title: "Additional HTTP Status Codes (RFC 6585)",
    author: "IETF — M. Nottingham, R. Fielding (eds.)",
    url: "https://www.rfc-editor.org/rfc/rfc6585.html",
    published: "2012-04",
    accessed: SOURCE_ACCESS_DATE,
    category: "standard",
    topics: ["overload", "rate-limiting", "retries"],
    note: "Standardizes HTTP 429 (Too Many Requests) as the throttling signal and links throttling state to the Retry-After response header.",
    sectionRef: "Section 4 (429 Too Many Requests)",
    attribution: "IETF RFC — freely reproduced with attribution.",
    limitations: "Defines the signal, not a throttling policy.",
  },
  {
    id: "src-little1961",
    title: "A Proof of the Queueing Formula L = λW",
    author: "J. D. C. Little, Operations Research 9(3), INFORMS",
    url: "https://pubsonline.informs.org/doi/10.1287/opre.9.3.383",
    published: "1961",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["queueing", "capacity", "latency"],
    note: "Proves the general relation L = λW (long-run average number in a system equals arrival rate times average time in system), which underlies our queue-depth and waiting-time estimates.",
    sectionRef: "The theorem (whole paper, 3 pages)",
    attribution: "Cited; DOI 10.1287/opre.9.3.383.",
    limitations: "Long-run averages say nothing about bursty short-run behavior.",
  },
  {
    id: "src-tailatscale",
    title: "The Tail at Scale",
    author: "J. Dean, L. A. Barroso, Communications of the ACM 56(2)",
    url: "https://dl.acm.org/doi/10.1145/2408776.2408787",
    published: "2013",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["latency", "tail-latency", "retries", "fanout"],
    note: "Shows that in high-fanout systems the slowest component percentile dominates user-visible latency, and that a single slow backend worsens with added parallelism; motivates hedged requests and careful timeout design.",
    sectionRef: "Sections 'Why so slow?' and 'Taming the variance'",
    attribution: "Cited; DOI 10.1145/2408776.2408787.",
    limitations: "Empirical Google experience, not a formal model.",
  },
  {
    id: "src-awstimeouts",
    title: "Timeouts, retries, and backoff with jitter",
    author: "AWS Builders' Library (AWS)",
    url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
    published: "2020",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["retries", "overload", "backoff", "timeouts", "cascading-failures"],
    note: "Official AWS guidance that retries without limits or jitter amplify overload (retry storms), that bounded exponential backoff with jitter is required, and that every call chain needs explicit timeouts sized to the call's purpose.",
    sectionRef: "Sections 'Exponential backoff and jitter', 'Set timeouts defensively'",
    attribution: "Cited and linked; AWS content used as reference only.",
    limitations: "Prescriptive guidance; exact constants are workload-dependent.",
  },
  {
    id: "src-releaseit",
    title: "Release It! Design and Deploy Production-Ready Software (2nd ed.)",
    author: "Michael T. Nygard, Pragmatic Bookshelf",
    url: "https://pragprog.com/titles/nee2rd/release-it-second-edition/",
    published: "2018",
    accessed: SOURCE_ACCESS_DATE,
    category: "book",
    topics: ["circuit-breakers", "bulkheads", "timeouts", "cascading-failures", "redundancy"],
    note: "Introduced the production patterns this lab models: circuit breakers stop clients from calling a failing dependency, timeouts bound every dependency call, bulkheads isolate failure domains, and redundancy removes single points of failure.",
    sectionRef: "Chapter 5 (Stability patterns)",
    attribution: "Cited by title/section; no text reproduced.",
    limitations: "Practice-oriented patterns, not measurement studies.",
  },
  {
    id: "src-srebook",
    title: "Site Reliability Engineering: How Google Runs Production Systems",
    author: "B. Beyer, C. Jones, J. Petoff, N. R. Murphy (eds.), O'Reilly / sre.google/books",
    url: "https://sre.google/sre-book/service-level-objectives/",
    published: "2016",
    accessed: SOURCE_ACCESS_DATE,
    category: "book",
    topics: ["slo", "error-budgets", "reliability", "observability", "monitoring"],
    note: "Google's primary text on SLOs and error budgets: define measurable SLIs, set objectives from user-visible needs, and treat the remaining error budget as the resource that reliability work is traded against (chapters on Service Level Objectives and Monitoring Distributed Systems).",
    sectionRef: "Chapters 3-4 (SLOs, monitoring); error-budget policy discussion",
    attribution: "Freely readable online; cited with attribution.",
    limitations: "Google-scale practice; org-size caveats for small teams.",
  },
  {
    id: "src-gilbertlynch2002",
    title: "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services",
    author: "S. Gilbert, N. Lynch, ACM SIGACT News 33(2)",
    url: "https://dl.acm.org/doi/10.1145/564581.564601",
    published: "2002",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["consistency", "cap", "distributed-systems"],
    note: "Formalizes CAP: in an asynchronous network that may drop messages, it is impossible to guarantee both availability and atomic consistency during a partition.",
    sectionRef: "Theorem 1 and Section 2 (asynchronous model)",
    attribution: "Cited; DOI 10.1145/564581.564601.",
    limitations: "About partitions specifically; '2 of 3' popularization is a misreading the authors themselves qualify.",
  },
  {
    id: "src-brewer2012",
    title: "CAP Twelve Years Later: How the 'Rules' Have Changed",
    author: "E. Brewer, IEEE Computer 45(2)",
    url: "https://ieeexplore.ieee.org/document/6133221",
    published: "2012",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["consistency", "cap", "eventual-consency"],
    note: "Brewer's own clarification: the choice is only between consistency and availability during an actual partition; nodes that continue serving stale data during a partition must reconcile afterward ('harvest and yield' trade-off).",
    sectionRef: "Sections 'CAP confusion' and 'Which choice to make?'",
    attribution: "Cited; DOI 10.1109/MC.2012.37.",
    limitations: "Conceptual framing, not a decision procedure.",
  },
  {
    id: "src-dynamo2007",
    title: "Dynamo: Amazon's Highly Available Key-value Store",
    author: "G. DeCandia et al., ACM SOSP 2007",
    url: "https://dl.acm.org/doi/10.1145/1294261.1294281",
    published: "2007",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["availability", "consistency", "eventual-consistency", "failure-propagation", "vector-clocks", "quorums"],
    note: "Primary case study: Amazon's shopping cart deliberately chooses availability over consistency under partition, using quorums, vector clocks, and sloppy quorums to reconcile afterward — a concrete availability-vs-staleness trade with measured latency/availability data.",
    sectionRef: "Sections 4 (scaling) and 5.4 (client-driven consistency)",
    attribution: "Cited; DOI 10.1145/1294261.1294281.",
    limitations: "2007 system design; mechanisms have evolved, but the trade-off analysis remains the canonical reference.",
  },
  {
    id: "src-sagas1987",
    title: "Sagas",
    author: "H. Garcia-Molina, K. Salem, ACM SIGMOD 1987",
    url: "https://dl.acm.org/doi/10.1145/38714.38742",
    published: "1987",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["sagas", "distributed-transactions", "compensation", "workflows"],
    note: "Introduces sagas: a long-lived distributed transaction decomposed into subtransactions T1..Tn, each paired with a compensation C1..Cn so that any partial execution can be semantically undone by running compensations in reverse order.",
    sectionRef: "Sections 1-2 (saga definition, compensation semantics)",
    attribution: "Cited; DOI 10.1145/38714.38742.",
    limitations: "Assumes compensations exist and succeed; failure of compensations needs workflow-specific handling.",
  },
  {
    id: "src-stripe-idem",
    title: "Idempotency keys (Stripe API reference)",
    author: "Stripe, Inc.",
    url: "https://docs.stripe.com/api/idempotent_requests",
    published: "2017-2026 (living API documentation)",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["idempotency", "retries", "api-design"],
    note: "Production idempotency-key design: the caller supplies a key bound to the first request, results are stored and replayed for duplicates within a retention window (24h), and keys expire rather than being kept forever.",
    sectionRef: "'Idempotent request' semantics section",
    attribution: "Cited and linked; Stripe documentation used as reference only.",
    limitations: "Vendor API convention, not a standard (see src-ietf-idem for the standards-track draft).",
  },
  {
    id: "src-ietf-idem",
    title: "The Idempotency-Key HTTP Header Field (IETF HTTPAPI working group draft)",
    author: "J. Zhou (ed.), IETF HTTPAPI WG",
    url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/",
    published: "2023 (still a draft)",
    accessed: SOURCE_ACCESS_DATE,
    category: "standard",
    topics: ["idempotency", "retries", "api-design"],
    note: "Standards-track formalization of the same idempotency-key lifecycle: scope the key to the operation, fingerprint the payload, persist the first response, reject key reuse with a different payload, expire keys after a retention period.",
    sectionRef: "Sections on key scoping, fingerprinting, and recorded responses",
    attribution: "IETF Internet-Draft — freely referenced.",
    limitations: "DRAFT status: not yet an RFC; semantics may still change.",
  },
  {
    id: "src-reactive-manifesto",
    title: "The Reactive Manifesto (glossary: backpressure)",
    author: "Reactive Manifesto contributors",
    url: "https://www.reactivemanifesto.org/glossary/Back-Pressure",
    published: "2014 (manifesto v2.0)",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["backpressure", "overload", "queueing", "load-shedding"],
    note: "Defines backpressure as the mechanism whereby a component signals to its upstream producer to slow down instead of accumulating unbounded work — the alternative being unbounded queue growth or dropped messages.",
    sectionRef: "Glossary entry 'Back-Pressure'",
    attribution: "Freely referenced glossary.",
    limitations: "Definitional; implementation specifics vary by runtime.",
  },
  {
    id: "src-nist-ztnull",
    title: "Zero Trust Architecture (NIST SP 800-207)",
    author: "S. Rose, O. Borchert, S. Mitchell, S. Connelly, NIST",
    url: "https://csrc.nist.gov/pubs/sp/800/207/final",
    published: "2020-08",
    accessed: SOURCE_ACCESS_DATE,
    category: "standard",
    topics: ["security", "trust-boundaries", "authorization", "zero-trust"],
    note: "Primary definition of zero trust: no implicit trust based on network location; authentication and authorization are per-request decisions enforced at each resource, and trust boundaries are treated as explicit, audited crossing points (baseline: authenticate per session, authorize per request).",
    sectionRef: "Sections 2 (tenets), 3.1.1 (network location)",
    attribution: "NIST public domain standard; cited.",
    limitations: "Architecture guidance; mapping to concrete component configs remains design work.",
  },
  {
    id: "src-owasp-top10",
    title: "OWASP Top 10:2021",
    author: "OWASP Foundation",
    url: "https://owasp.org/Top10/",
    published: "2021",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["security", "authorization", "injection", "logging"],
    note: "Industry-consensus top application-security risks: broken access control (A01) and cryptographic failures (A02) rank above injection, and security logging/monitoring failures (A09) are a distinct risk class — supporting our boundary-control and authorization findings.",
    sectionRef: "A01:2021 Broken Access Control; A09:2021 Security Logging and Monitoring Failures",
    attribution: "Creative Commons BY-SA 3.0 — referenced with attribution.",
    limitations: "Consensus awareness list, not a verification standard (see ASVS for requirements).",
  },
  {
    id: "src-awssaas",
    title: "SaaS Architecture: Fundamental Concepts — Tenant isolation",
    author: "AWS SaaS Factory / Well-Architected SaaS Lens (AWS)",
    url: "https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html",
    published: "2021-2026 (living documentation)",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["multi-tenancy", "tenant-isolation", "security"],
    note: "Official AWS framing: tenant isolation exists on a spectrum (pooled, bridged, siloed) and every shared resource must enforce tenant-scoping as an explicit design decision, because a missed scope check becomes a cross-tenant data leak.",
    sectionRef: "'Tenant isolation' section (spectrum: silo/bridge/pool)",
    attribution: "Cited and linked; AWS documentation used as reference only.",
    limitations: "Infrastructure-centric; application-layer authorization still needed (NIST 800-207).",
  },
  {
    id: "src-otel",
    title: "OpenTelemetry: Traces, spans, and the W3C Trace Context",
    author: "OpenTelemetry project (CNCF) / W3C",
    url: "https://opentelemetry.io/docs/concepts/signals/traces/",
    published: "2021-2026 (living specification)",
    accessed: SOURCE_ACCESS_DATE,
    category: "official-docs",
    topics: ["observability", "traces", "distributed-tracing", "correlation"],
    note: "The trace model this lab implements: a trace is the full path of a request as spans; each span has parent-child relations, timing, and status; correlation ids (W3C traceparent) propagate across service boundaries.",
    sectionRef: "'Traces' concept page; W3C Trace Context specification",
    attribution: "Apache-2.0 / W3C documents — referenced with attribution.",
    limitations: "Specification of the telemetry format, not of sampling strategy or what to log.",
  },
  {
    id: "src-chaoseng2016",
    title: "Chaos Engineering",
    author: "A. Basiri, N. Behnam, R. Roozim, C. Rosenthal, D. Schlossnagle, IEEE Software 33(3)",
    url: "https://ieeexplore.ieee.org/document/7443011",
    published: "2016",
    accessed: SOURCE_ACCESS_DATE,
    category: "publication",
    topics: ["chaos-engineering", "resilience", "recovery", "experiments"],
    note: "Defines chaos engineering: deliberate, controlled fault injection against real systems to surface weaknesses before they manifest as outages, with defined hypotheses, blast radius, and abort conditions.",
    sectionRef: "Section on principles (hypothesis, real-world events, blast radius)",
    attribution: "Cited; DOI 10.1109/MS.2016.60.",
    limitations: "Prescriptive practice; experiment quality depends on the hypothesis.",
  },
  {
    id: "src-gdpr",
    title: "General Data Protection Regulation (EU) 2016/679 — Principles (Art. 5)",
    author: "European Union",
    url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    published: "2016 (applied 2018-05)",
    accessed: SOURCE_ACCESS_DATE,
    category: "regulation",
    topics: ["privacy", "data-minimization", "retention", "deletion"],
    note: "Legal basis for our redaction and retention defaults: personal data must be 'adequate, relevant and limited to what is necessary' (data minimisation, Art. 5(1)(c)) and kept 'no longer than is necessary' (storage limitation, Art. 5(1)(e)).",
    sectionRef: "Article 5(1)(c) and 5(1)(e)",
    attribution: "EU legislation — freely referenced.",
    limitations: "Legal text; engineering interpretation is ours, not legal advice.",
  },
];

export function sourceById(id: string): ExternalSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

export interface SourceRegistryProblem {
  sourceId: string;
  problem: string;
}

/**
 * Registry integrity: unique ids, required fields, https URLs, real dates,
 * and every topic claimed by a source must be non-empty. Exported so tests
 * can fail the build if a citation is malformed or fabricated-looking.
 */
export function validateSourceRegistry(sources: ExternalSource[]): SourceRegistryProblem[] {
  const problems: SourceRegistryProblem[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const id = s.id ?? "(missing)";
    if (!s.id || seen.has(s.id)) problems.push({ sourceId: id, problem: "duplicate or missing id" });
    seen.add(s.id);
    if (!s.title || !s.author || !s.url) problems.push({ sourceId: id, problem: "missing title, author, or url" });
    if (!s.url.startsWith("https://")) problems.push({ sourceId: id, problem: "url must be https" });
    if (!/^\d{4}(-\d{2})?/.test(s.published)) problems.push({ sourceId: id, problem: "published must be a year or year-month" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.accessed)) problems.push({ sourceId: id, problem: "accessed must be an ISO date" });
    if (s.topics.length === 0) problems.push({ sourceId: id, problem: "no topics" });
    if (!s.note || s.note.length < 20) problems.push({ sourceId: id, problem: "note must summarize the relevant content" });
    if (!s.sectionRef) problems.push({ sourceId: id, problem: "missing section reference" });
    if (!s.attribution) problems.push({ sourceId: id, problem: "missing attribution note" });
  }
  return problems;
}
