/**
 * Scenario library. Five fully specified scenarios; each requirement carries
 * (a) structural evidence tests and (b) the requirement→decision map row
 * (decision, concept topic, reason, trade-off). There is deliberately no
 * single "correct" architecture: the tests accept any structure that gives
 * the evidence.
 */
import { CapacityInputs, DEFAULT_CAPACITY } from "./capacity";
import { Kind } from "./model";
import { Need, Requirement, Test } from "./requirements";

export interface Scenario {
  id: string;
  name: string;
  tagline: string;
  description: string;
  constraints: string[];
  /** plausible-sounding statements that are NOT constraints of this scenario (challenge step 4) */
  decoyConstraints: string[];
  traffic: string[];
  consistency: string[];
  reliability: string[];
  security: string[];
  budget: string[];
  requirements: Requirement[];
  capacity: CapacityInputs;
  /** scenario notes shown prominently (e.g. simulated payments) */
  notice?: string;
}

const k = (...kinds: Kind[]): Test => ({ t: "kind", kinds });
const chain = (...c: Kind[][]): Test => ({ t: "chain", chain: c });
const path = (from: Kind[], to: Kind[]): Test => ({ t: "path", from, to });
const any = (...tests: Test[]): Test => ({ t: "anyOf", tests });
const all = (...tests: Test[]): Test => ({ t: "allOf", tests });
const prop = (kinds: Kind[], key: string, op: "eq" | "ne" | "gt" | "in", value: string | number | boolean | Array<string | number | boolean>): Test => ({
  t: "prop", kinds, where: [{ key, op, value }],
});
const guard = (policy: Kind, targets: Kind[], key?: string, op?: "eq" | "ne" | "gt" | "in", value?: string | number | boolean | Array<string | number | boolean>): Test => ({
  t: "guard", policy, targets, where: key && op ? [{ key, op, value: value as never }] : [],
});
const custom = (id: Extract<Test, { t: "custom" }>["id"]): Test => ({ t: "custom", id });
const need = (text: string, test: Test): Need => ({ text, test });

const SVC: Kind[] = ["app_service", "web_app"];
const TOPIC: Kind[] = ["pubsub", "event_bus"];
const EXT: Kind[] = ["external_service"];

const authNeed = need("An authentication service, or a gateway that validates credentials", any(k("auth_service"), prop(["api_gateway"], "validatesAuth", "eq", true)));
const limitNeed = need("A rate limiter, or a gateway with built-in rate limiting", any(k("rate_limiter"), prop(["api_gateway"], "builtInRateLimit", "eq", true)));
const idemNeed = need("The service that performs the operation records keys in an Idempotency Store", path(["app_service", "web_app", "worker"], ["idempotency_store"]));
const retryNeed = need("A bounded retry policy with backoff on the remote dependency", guard("retry_policy", EXT, "backoff", "in", ["exponential", "exponential_jitter"]));
const retryBounded = need("…whose attempts are limited (not 0 / unbounded)", guard("retry_policy", EXT, "maxAttempts", "gt", 0));
const timeoutNeed = need("Every caller of the external dependency has a finite timeout", custom("externalTimeout"));

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------- 01
  {
    id: "pdf-saas",
    name: "Viral PDF Generation SaaS",
    tagline: "Upload documents, get AI-generated PDFs. Traffic can spike without warning.",
    description:
      "A user uploads documents and requests AI-generated PDFs. Generation is slow (30–120 s) and relies on a paid external AI API. A social-media mention can multiply traffic within minutes.",
    constraints: [
      "Generation takes tens of seconds — it cannot block an HTTP request.",
      "The external AI API is billed per call and occasionally fails or slows down.",
      "A small team operates this: prefer fewer moving parts.",
      "Uploads up to 50 MB.",
    ],
    decoyConstraints: [
      "Must serve ten million concurrent WebSocket users.",
      "Data must be strongly consistent across three continents.",
      "Everything must run on-premises with no managed services.",
    ],
    traffic: ["Average ≈ 20 req/s (assumption).", "Viral peak ≈ 200 req/s for ≈ 5 minutes (assumption).", "≈ 2 PDF jobs/s at average, proportional at peak."],
    consistency: ["Job state may be eventually consistent for a few seconds.", "A job must never be billed twice."],
    reliability: ["A crashed worker must not lose a job.", "AI API outages must not take the whole API down."],
    security: ["Authenticated users only.", "Uploaded files are private."],
    budget: ["AI API calls are the dominant cost: duplicate jobs are directly wasted money.", "Cost visibility is required (queue depth, worker count)."],
    capacity: { ...DEFAULT_CAPACITY, avgRps: 20, peakRps: 200, jobArrivalRate: 2, workers: 2, workerRatePerSec: 0.5, peakDurationSec: 300 },
    requirements: [
      { id: "pdf-r1", type: "non-functional", text: "Protect the API from abusive traffic.", topics: [1, 5],
        needs: [limitNeed],
        decision: "Rate limit per user/API key at the edge or gateway.", reason: "Bounds the damage of abuse and accidental floods before they reach expensive work.", tradeoff: "Legitimate bursts can be rejected (429s); limits need tuning." },
      { id: "pdf-r2", type: "functional", text: "Authenticate users.", topics: [5],
        needs: [authNeed],
        decision: "Validate credentials at the gateway or a dedicated auth service.", reason: "Centralises identity so services do not each re-implement it.", tradeoff: "Auth becomes a critical dependency on every request." },
      { id: "pdf-r3", type: "functional", text: "Generate large PDFs asynchronously.", topics: [15],
        needs: [need("A service enqueues work", chain(SVC, ["queue"])), need("A worker consumes the queue", chain(["queue"], ["worker"]))],
        decision: "API enqueues a job; a worker pool generates the PDF.", reason: "Decouples the request from heavy processing so spikes become backlog, not outages.", tradeoff: "Adds eventual consistency and a job-status flow the UI must handle." },
      { id: "pdf-r4", type: "functional", text: "Avoid duplicate job creation or billing.", topics: [14],
        needs: [idemNeed],
        decision: "Idempotency key stored with the first result.", reason: "Makes client and queue retries safe.", tradeoff: "Needs durable key/result storage and a retention policy." },
      { id: "pdf-r5", type: "non-functional", text: "Handle external AI API failures.", topics: [10, 11, 12, 13],
        needs: [timeoutNeed, retryNeed, retryBounded],
        decision: "Timeout plus bounded retries with exponential backoff (and optionally a circuit breaker).", reason: "Limits waiting and absorbs transient failure without hammering a struggling API.", tradeoff: "Increases worst-case job completion time." },
      { id: "pdf-r6", type: "functional", text: "Notify users when processing completes.", topics: [16],
        needs: [need("The worker publishes a completion event to a topic/bus", chain(["worker"], TOPIC)), need("Something subscribes to deliver the notification", chain(["worker"], TOPIC, SVC))],
        decision: "Publish a 'job completed' event; a notifier subscribes.", reason: "Keeps the worker unaware of how users are notified.", tradeoff: "Another asynchronous hop to monitor." },
      { id: "pdf-r7", type: "functional", text: "Track job state.", topics: [2],
        needs: [need("Workers and the API persist job state in a database", path(["worker"], ["postgres"])), need("The API can read job state", path(SVC, ["postgres"]))],
        decision: "Persist job status (queued/running/done/failed) in PostgreSQL.", reason: "The queue is a transport, not a source of truth for status.", tradeoff: "A second write on every state change." },
      { id: "pdf-r8", type: "non-functional", text: "Recover from worker failures.", topics: [15],
        needs: [need("Queue persists messages and redelivers after a visibility timeout", prop(["queue"], "visibilityTimeoutSec", "gt", 0)), need("Repeatedly failing jobs go to a dead letter queue", chain(["queue"], ["dlq"]))],
        decision: "Durable queue with visibility timeout, bounded delivery attempts and a DLQ.", reason: "A crashed worker's job becomes visible again; poison jobs stop looping.", tradeoff: "At-least-once delivery means handlers must be idempotent." },
      { id: "pdf-r9", type: "non-functional", text: "Keep operating costs visible.", topics: [15, 8],
        needs: [need("Workers or services emit metrics (queue depth, instance count)", any(prop(["worker"], "observability", "in", ["logs_metrics", "logs_metrics_tracing"]), prop(["app_service"], "observability", "in", ["logs_metrics", "logs_metrics_tracing"])))],
        decision: "Emit metrics for queue depth, worker count and AI calls per job.", reason: "You cannot manage a cost you cannot see.", tradeoff: "Metrics pipelines have their own cost." },
      { id: "pdf-r10", type: "functional", text: "Delete expired uploads on a schedule without double-running.", topics: [20],
        needs: [need("A scheduled runner triggers cleanup", chain(["cron_runner"], [...SVC, "queue"])), need("Duplicate scheduled runs are prevented by something real", custom("cronProtected"))],
        decision: "Cron runner with a lock/lease held in a shared store.", reason: "With several instances, a bare cron runs N times.", tradeoff: "Lock expiry and clock assumptions must be reasoned about." },
    ],
  },
  // ---------------------------------------------------------------- 02
  {
    id: "ecommerce-checkout",
    name: "E-Commerce Checkout",
    tagline: "Browse, add to cart, pay — without double charges or oversold stock.",
    description:
      "Customers browse products, add items to carts and place orders. Placing an order touches inventory, billing and shipping, owned by different services. Sales events cause traffic spikes.",
    constraints: [
      "Inventory, billing and shipping are separate services with separate data.",
      "The recommendation widget is optional; checkout is not.",
      "The payment provider (simulated here) can be slow or fail.",
      "Overselling stock is worse than briefly rejecting an order.",
    ],
    decoyConstraints: ["Orders must be processed in under 5 milliseconds end-to-end.", "All services must share one database for simplicity of joins.", "Customers never retry payments."],
    traffic: ["Average ≈ 50 req/s; flash-sale peak ≈ 500 req/s (assumption).", "Product browsing is read-heavy (≈ 80% reads)."],
    consistency: ["Inventory must not go negative.", "A payment must be charged at most once per order."],
    reliability: ["Recommendation outage must not block checkout.", "Partial failure (paid but not reserved) must be recoverable."],
    security: ["Payment data never stored in this system (simulated provider only).", "Order APIs require authentication."],
    budget: ["Prefer scaling the stateless tier horizontally before adding infrastructure."],
    capacity: { ...DEFAULT_CAPACITY, avgRps: 50, peakRps: 500, instances: 4, perInstanceRps: 150, readShare: 0.8, cacheHitRate: 0.85, jobArrivalRate: 3, workers: 2, workerRatePerSec: 2, peakDurationSec: 600 },
    requirements: [
      { id: "ec-r1", type: "non-functional", text: "Handle traffic spikes.", topics: [3, 2],
        needs: [need("Traffic is spread by a load balancer or gateway", k("load_balancer", "api_gateway")), need("The application tier runs more than one instance", prop(SVC, "instances", "gt", 1))],
        decision: "Stateless app instances behind a load balancer.", reason: "Adds capacity horizontally and survives one instance failing.", tradeoff: "Sessions/state must live outside the instances." },
      { id: "ec-r2", type: "functional", text: "Serve the product catalog quickly.", topics: [2],
        needs: [need("A cache with an expiry (TTL) in front of catalog reads", prop(["redis_cache"], "ttlSeconds", "gt", 0))],
        decision: "Cache-aside catalog reads with a TTL.", reason: "Offloads the read-heavy majority of traffic from the database.", tradeoff: "Prices/stock shown may be briefly stale." },
      { id: "ec-r3", type: "non-functional", text: "Protect inventory consistency.", topics: [18, 19],
        needs: [need("Inventory data has a single declared owner", prop(["postgres"], "dataOwner", "ne", ""))],
        decision: "One service owns inventory writes; others call it.", reason: "A single writer prevents conflicting updates from several services.", tradeoff: "Other services depend on the owner's availability." },
      { id: "ec-r4", type: "non-functional", text: "Avoid duplicate payment processing.", topics: [14],
        needs: [idemNeed],
        decision: "Idempotency key per checkout attempt.", reason: "Double-clicks and retries must not charge twice.", tradeoff: "Keys must be stored and expired." },
      { id: "ec-r5", type: "functional", text: "Coordinate inventory, billing and shipping.", topics: [18, 19],
        needs: [need("A saga or transaction coordinator coordinates the steps", k("saga", "tx_coordinator")), need("If a saga is used, compensation is defined", any(prop(["saga"], "compensation", "eq", "defined_per_step"), k("tx_coordinator")))],
        decision: "Saga orchestrator with compensating actions.", reason: "Cross-service ACID transactions are impractical; a saga gives recoverable steps.", tradeoff: "Intermediate states are visible; compensation logic must be written and tested." },
      { id: "ec-r6", type: "non-functional", text: "Keep checkout usable when recommendations fail.", topics: [10],
        needs: [need("A circuit breaker with a fallback protects the recommendation call", guard("circuit_breaker", [...SVC, ...EXT], "fallback", "ne", "none"))],
        decision: "Circuit breaker with a degrade-feature fallback.", reason: "Fails fast and hides an optional feature instead of slowing checkout.", tradeoff: "Users silently lose recommendations during an outage." },
      { id: "ec-r7", type: "non-functional", text: "Recover from partial failures.", topics: [19],
        needs: [need("Saga state is persisted so it can resume", prop(["saga"], "persistsState", "eq", true))],
        decision: "Persist saga state before each step.", reason: "A crash mid-workflow can resume or compensate.", tradeoff: "Extra writes on the order path." },
      { id: "ec-r8", type: "functional", text: "Track order state.", topics: [2],
        needs: [need("Order state is persisted", path(SVC, ["postgres"]))],
        decision: "Order status in PostgreSQL.", reason: "Durable, queryable source of truth.", tradeoff: "The database becomes a shared hot spot." },
      { id: "ec-r9", type: "non-functional", text: "Analytics must not block checkout.", topics: [16, 17],
        needs: [need("Checkout publishes events and does not call analytics synchronously", chain(SVC, TOPIC))],
        decision: "Publish 'order placed' to a topic that analytics subscribes to.", reason: "Isolates analytics failures from checkout.", tradeoff: "Asynchronous processing complexity; events may be delayed." },
      { id: "ec-r10", type: "non-functional", text: "Bound the wait on the payment provider.", topics: [11],
        needs: [timeoutNeed],
        decision: "Explicit timeout on payment calls.", reason: "A hung provider must not hold every checkout thread.", tradeoff: "A slow-but-succeeding charge may be treated as failed — hence idempotency." },
    ],
  },
  // ---------------------------------------------------------------- 03
  {
    id: "realtime-collab",
    name: "Real-Time Collaboration App",
    tagline: "Many people editing one document, live.",
    description:
      "Multiple users edit shared documents and see each other's cursors and changes live. Connections drop on flaky networks and must resume without losing edits.",
    constraints: [
      "Edits must reach collaborators with sub-second latency — a persistent connection is needed.",
      "Plain request/response HTTP polling is too slow and wasteful for live edits.",
      "Exports and snapshots are slow and not latency-sensitive.",
      "Edit ordering within a document must be explicit.",
    ],
    decoyConstraints: ["Every keystroke must be placed on a message queue for durability.", "Each user must have a dedicated server.", "Documents are written once and never edited."],
    traffic: ["≈ 5,000 concurrent connections; ≈ 300 edit events/s (assumption).", "Document snapshots are a few jobs per minute."],
    consistency: ["Per-document ordering of edits must be defined (e.g. a single owner of a document's session).", "Presence data is ephemeral and may be slightly stale."],
    reliability: ["Dropped connections reconnect and resume.", "Unhealthy instances are removed from rotation."],
    security: ["Authenticate on connect.", "Presence cache must not leak other tenants' data."],
    budget: ["Avoid infrastructure that adds latency to the live path."],
    capacity: { ...DEFAULT_CAPACITY, avgRps: 300, peakRps: 900, requestMs: 40, instances: 4, perInstanceRps: 400, concurrencyPerInstance: 2000, readShare: 0.5, cacheHitRate: 0.9, jobArrivalRate: 0.2, workers: 1, workerRatePerSec: 0.1, peakDurationSec: 120 },
    requirements: [
      { id: "rt-r1", type: "functional", text: "Support persistent connections for live edits.", topics: [4, 3],
        needs: [need("A service is configured to serve WebSocket traffic", prop(["app_service"], "transport", "eq", "websocket"))],
        decision: "WebSocket-serving application service behind a proxy/load balancer.", reason: "Server push over a persistent connection beats polling for latency and overhead.", tradeoff: "Stateful connections complicate scaling and deploys." },
      { id: "rt-r2", type: "functional", text: "Handle user presence.", topics: [2, 17],
        needs: [need("Presence lives in a fast ephemeral store", chain(["app_service"], ["redis_cache"]))],
        decision: "Presence in Redis with a short TTL.", reason: "Presence is ephemeral and read/written constantly.", tradeoff: "May be briefly stale after a crash." },
      { id: "rt-r3", type: "non-functional", text: "Manage connection failures.", topics: [3, 4, 9],
        needs: [need("A health check guards the real-time service", guard("health_check", ["app_service"])), need("A load balancer or proxy distributes connections", k("load_balancer", "reverse_proxy"))],
        decision: "Health-checked instances behind a load balancer.", reason: "Failed instances stop receiving connections; clients reconnect to healthy ones.", tradeoff: "Reconnect storms after an instance dies." },
      { id: "rt-r4", type: "functional", text: "Persist changes.", topics: [2],
        needs: [need("The real-time service persists edits", path(["app_service"], ["postgres"]))],
        decision: "Durable store for edits/snapshots.", reason: "Memory-only state is lost on restart.", tradeoff: "Write latency; batching changes durability guarantees." },
      { id: "rt-r5", type: "non-functional", text: "Recover cleanly from reconnects.", topics: [3, 14],
        needs: [need("Persisted state has a declared owner (single writer per document)", prop(["postgres"], "dataOwner", "ne", ""))],
        decision: "Clients resume from the last persisted version; one owner orders writes.", reason: "A reconnecting client needs an authoritative state to resume from.", tradeoff: "Resume protocol adds client complexity." },
      { id: "rt-r6", type: "non-functional", text: "Do not put unnecessary queues in the real-time path.", topics: [15, 16],
        needs: [need("A real-time service exists and no queue sits between real-time services", custom("noRealtimeQueue"))],
        decision: "Keep live edits on the persistent connection / direct path; no queue hop.", reason: "A queue adds latency and the WebSocket still has to deliver the result.", tradeoff: "Backpressure must be handled in the real-time service itself." },
      { id: "rt-r7", type: "functional", text: "Run exports and snapshots in the background.", topics: [15],
        needs: [need("Non-real-time work is queued and processed by workers", chain(["app_service"], ["queue"], ["worker"]))],
        decision: "Queue + worker for exports/snapshots only.", reason: "Slow work must not block live editing.", tradeoff: "Users wait for export completion." },
      { id: "rt-r8", type: "non-functional", text: "Bound waits on dependencies.", topics: [11],
        needs: [need("Some caller has a finite timeout (service property or Timeout component)", any(prop(["app_service", "web_app", "worker", "auth_service"], "requestTimeoutMs", "gt", 0), k("timeout")))],
        decision: "Explicit timeouts on outbound calls.", reason: "A stuck dependency must not freeze connections.", tradeoff: "Premature timeouts abort legitimate slow operations." },
      { id: "rt-r9", type: "non-functional", text: "Authenticate on connect.", topics: [5],
        needs: [authNeed],
        decision: "Validate a token during the WebSocket handshake.", reason: "A persistent connection must be authenticated once, up front.", tradeoff: "Token expiry during a long-lived connection needs a refresh plan." },
      { id: "rt-r10", type: "non-functional", text: "Explain ordering and consistency assumptions.", topics: [17],
        needs: [need("An ADR linked to this requirement documents the assumption", custom("adr"))],
        decision: "Record an ADR on per-document ordering and eventual consistency of presence.", reason: "Ordering guarantees are a design decision, not an accident.", tradeoff: "Documentation must be kept current." },
    ],
  },
  // ---------------------------------------------------------------- 04
  {
    id: "notification-platform",
    name: "Notification and Email Platform",
    tagline: "Accept fast, deliver reliably, never send twice if you can help it.",
    description:
      "Applications call an API to send emails, SMS or push messages through third-party providers. Providers fail transiently, and some messages can never be delivered.",
    constraints: [
      "Provider APIs are slow and flaky; callers must not wait on them.",
      "Duplicate notifications annoy users (and cost money for SMS).",
      "Some messages will never succeed (bad address) and must not loop forever.",
      "Daily digests run on a schedule across several instances.",
    ],
    decoyConstraints: ["Notifications must be exactly-once end-to-end with no duplicates ever.", "Callers require the provider's response synchronously.", "The scheduler must run on a single hand-managed server."],
    traffic: ["Average ≈ 30 req/s; campaign bursts ≈ 300 req/s (assumption).", "Digest runs produce ≈ 100k messages over a few minutes."],
    consistency: ["Delivery state is eventually consistent.", "At-least-once delivery with idempotent sends is accepted."],
    reliability: ["Transient provider failures are retried.", "Permanently failing jobs are parked and visible."],
    security: ["Only authenticated applications may send.", "No message bodies are exposed in logs (assumption)."],
    budget: ["SMS has a per-message cost: duplicates are directly wasteful."],
    capacity: { ...DEFAULT_CAPACITY, avgRps: 30, peakRps: 300, jobArrivalRate: 25, workers: 5, workerRatePerSec: 6, peakDurationSec: 180, instances: 2, perInstanceRps: 200 },
    requirements: [
      { id: "nt-r1", type: "functional", text: "Accept notification requests quickly.", topics: [15],
        needs: [need("The API hands requests to a queue", chain(SVC, ["queue"]))],
        decision: "Enqueue and return 202.", reason: "Caller latency is independent of provider latency.", tradeoff: "Callers learn the result later." },
      { id: "nt-r2", type: "functional", text: "Process notifications asynchronously.", topics: [15],
        needs: [need("Workers consume the queue", chain(["queue"], ["worker"]))],
        decision: "Worker pool consuming a queue.", reason: "Throughput scales by adding workers.", tradeoff: "Ordering is not guaranteed unless designed." },
      { id: "nt-r3", type: "non-functional", text: "Retry transient provider failures.", topics: [12, 13],
        needs: [retryNeed, retryBounded],
        decision: "Bounded exponential backoff with jitter on provider calls.", reason: "Most provider errors are brief; spacing retries avoids a thundering herd.", tradeoff: "Delivery is delayed during incidents." },
      { id: "nt-r4", type: "non-functional", text: "Avoid duplicate sends where possible.", topics: [14],
        needs: [idemNeed],
        decision: "Idempotency key per notification.", reason: "Queue redelivery and retries would otherwise double-send.", tradeoff: "True exactly-once is not achievable; this narrows the window." },
      { id: "nt-r5", type: "non-functional", text: "Handle permanently failing jobs.", topics: [15],
        needs: [need("A DLQ is attached to the queue", chain(["queue"], ["dlq"])), need("The DLQ alerts someone", custom("dlqAlerting"))],
        decision: "DLQ with an alert on non-empty.", reason: "Poison messages stop blocking others and are visible.", tradeoff: "Someone must triage and redrive." },
      { id: "nt-r6", type: "functional", text: "Track delivery state.", topics: [2],
        needs: [need("Workers record delivery state durably", path(["worker"], ["postgres"]))],
        decision: "Delivery status table.", reason: "Callers and support need to know what happened.", tradeoff: "A write per status change." },
      { id: "nt-r7", type: "functional", text: "Schedule digests.", topics: [20],
        needs: [need("A scheduled runner starts digest generation", chain(["cron_runner"], [...SVC, "queue"]))],
        decision: "Cron runner enqueues digest jobs.", reason: "Time-based work needs a trigger.", tradeoff: "Missed runs during downtime must be considered." },
      { id: "nt-r8", type: "non-functional", text: "Prevent duplicate scheduled execution.", topics: [20, 14],
        needs: [need("Duplicate-run protection is configured AND backed by a shared store", custom("cronProtected"))],
        decision: "Distributed lock/lease (or idempotent digest keys).", reason: "Multiple scheduler instances would each send the digest.", tradeoff: "Locks can expire mid-run; reason about overlap." },
      { id: "nt-r9", type: "functional", text: "Fan out one event to several channels.", topics: [16],
        needs: [need("A topic delivers to at least two subscribers", custom("fanout2"))],
        decision: "Publish 'notification requested'; email/SMS/push subscribe.", reason: "Adding a channel does not change the publisher.", tradeoff: "Per-channel failure handling." },
      { id: "nt-r10", type: "non-functional", text: "Bound waits on providers.", topics: [11],
        needs: [timeoutNeed],
        decision: "Per-provider timeouts.", reason: "A stalled provider must not stall every worker.", tradeoff: "Timed-out sends may still have succeeded — idempotency again." },
    ],
  },
  // ---------------------------------------------------------------- 05
  {
    id: "payments-rewards",
    name: "Payment and Rewards Platform",
    tagline: "A payment triggers receipts, rewards and analytics — correctness first.",
    description:
      "A payment may trigger rewards, receipts, analytics and other downstream workflows. Money movement must be correct, auditable and recoverable.",
    constraints: [
      "No double charges, ever; retries are a fact of life.",
      "Rewards and receipts are downstream of the payment and must not delay or break it.",
      "Every state change must be auditable.",
      "All payment behavior in this Studio is simulated — no real money or provider is involved.",
    ],
    decoyConstraints: ["Rewards must be granted inside the payment's database transaction, with no exceptions.", "The payment provider guarantees exactly-once delivery.", "Audit records may be overwritten after 24 hours."],
    traffic: ["Average ≈ 40 payments/s; peak ≈ 150/s (assumption)."],
    consistency: ["The payment ledger is strongly consistent.", "Rewards/receipts are eventually consistent."],
    reliability: ["Partial failure triggers compensation, not silence.", "A downstream outage must not roll back a settled payment."],
    security: ["Authenticated, authorised callers only.", "No real card data handled (simulated)."],
    budget: ["Reuse a single event backbone for receipts, rewards and analytics."],
    notice: "SIMULATION: every payment component here is an educational model. Marking the external provider 'simulated' is part of the design — this is not real payment processing.",
    capacity: { ...DEFAULT_CAPACITY, avgRps: 40, peakRps: 150, instances: 3, perInstanceRps: 100, readShare: 0.3, cacheHitRate: 0.5, jobArrivalRate: 40, workers: 4, workerRatePerSec: 12, peakDurationSec: 120 },
    requirements: [
      { id: "pay-r1", type: "non-functional", text: "Preserve transaction correctness.", topics: [18],
        needs: [need("The ledger database has one declared owner", prop(["postgres"], "dataOwner", "ne", ""))],
        decision: "A single service owns the ledger and writes inside local transactions.", reason: "Correctness is easiest with one writer and ACID transactions.", tradeoff: "Other services depend on its availability." },
      { id: "pay-r2", type: "non-functional", text: "Prevent duplicate charges.", topics: [14],
        needs: [idemNeed, need("Keys are claimed atomically", prop(["idempotency_store"], "atomicClaim", "eq", true))],
        decision: "Atomic idempotency-key claim before charging.", reason: "Two concurrent identical requests must not both pass.", tradeoff: "Extra store on the critical path." },
      { id: "pay-r3", type: "non-functional", text: "Handle partial failures.", topics: [19],
        needs: [need("A saga persists its workflow state", prop(["saga"], "persistsState", "eq", true))],
        decision: "Persisted saga state per payment.", reason: "A crash between steps can resume or compensate.", tradeoff: "More writes, more states to reason about." },
      { id: "pay-r4", type: "functional", text: "Track transaction state.", topics: [2],
        needs: [need("Transaction state is stored durably", path(SVC, ["postgres"]))],
        decision: "State machine in the ledger database.", reason: "A single durable source of truth.", tradeoff: "Hot table under load." },
      { id: "pay-r5", type: "functional", text: "Coordinate distributed operations.", topics: [18, 19],
        needs: [need("A saga or coordinator orchestrates the steps", k("saga", "tx_coordinator"))],
        decision: "Saga orchestrator (2PC only where participants support it and blocking is acceptable).", reason: "Cross-service steps need explicit coordination.", tradeoff: "Saga: visible intermediate states. 2PC: blocking and a coordinator SPOF." },
      { id: "pay-r6", type: "functional", text: "Support compensating actions.", topics: [19],
        needs: [need("Compensation is defined for each step", prop(["saga"], "compensation", "eq", "defined_per_step"))],
        decision: "Refund/release actions per step.", reason: "You cannot roll back an external effect; you undo it with a new action.", tradeoff: "Compensations can fail too and need monitoring." },
      { id: "pay-r7", type: "non-functional", text: "Keep auditable records.", topics: [16, 17],
        needs: [need("Events are retained on the bus/topic", any(prop(["event_bus"], "retentionHours", "gt", 0), prop(["pubsub"], "retentionHours", "gt", 0))), need("The ledger has a backup/recovery assumption", prop(["postgres"], "backup", "ne", "none"))],
        decision: "Retained event log plus ledger backups.", reason: "Auditors need history; recovery needs backups.", tradeoff: "Storage cost and data-retention obligations." },
      { id: "pay-r8", type: "non-functional", text: "Downstream workflows must not block payment.", topics: [16, 17],
        needs: [need("The payment service publishes events", chain(SVC, TOPIC)), need("At least one subscriber consumes them", chain(TOPIC, [...SVC, "worker"]))],
        decision: "Publish 'payment settled'; rewards/receipts/analytics subscribe.", reason: "Isolates downstream failures from the payment path.", tradeoff: "Eventual consistency; duplicate events require idempotent subscribers." },
      { id: "pay-r9", type: "non-functional", text: "Clearly mark simulated payment behavior.", topics: [],
        needs: [need("The external payment provider is marked 'simulated'", prop(["external_service"], "simulated", "eq", true))],
        decision: "Mark the provider as simulated everywhere it appears.", reason: "Honesty: no one should mistake this for real payment processing.", tradeoff: "None for the design; it limits claims you can make." },
      { id: "pay-r10", type: "non-functional", text: "Observe the payment flow.", topics: [17],
        needs: [need("The payment service emits logs and metrics", prop(["app_service"], "observability", "in", ["logs_metrics", "logs_metrics_tracing"]))],
        decision: "Metrics and traces on the payment path.", reason: "You cannot debug or audit what you cannot see.", tradeoff: "Telemetry cost and data-sensitivity review." },
      { id: "pay-r11", type: "non-functional", text: "Bound waits and retries against the provider.", topics: [11, 12, 13],
        needs: [timeoutNeed, retryBounded],
        decision: "Timeout plus bounded retries (safe only because charges are idempotent).", reason: "Prevents hangs and unbounded retry storms.", tradeoff: "Longer worst-case payment latency." },
    ],
  },
];

export const getScenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

export const allTopicsOf = (s: Scenario): number[] => [...new Set(s.requirements.flatMap((r) => r.topics))].sort((a, b) => a - b);
