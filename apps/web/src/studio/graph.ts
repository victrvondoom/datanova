/**
 * Architecture analysis helpers shared by validation, requirement evidence,
 * the failure lab and review. Pure functions over `Architecture`.
 */
import {
  Architecture,
  ArchNode,
  EDGE_KINDS,
  Kind,
  STORE_KINDS,
  bool,
  incoming,
  num,
  outgoing,
  policiesFor,
  str,
} from "./model";

export const PAYMENT_NAME = /pay|bill|charge|checkout|order|invoice/i;

/** "Payment-like": explicit flag, or a name that suggests charging money. */
export function isPaymentLike(n: ArchNode): boolean {
  if (n.kind !== "app_service" && n.kind !== "web_app" && n.kind !== "worker") return false;
  return bool(n, "paymentLike") || PAYMENT_NAME.test(n.name);
}

export const clients = (a: Architecture): ArchNode[] => a.nodes.filter((n) => n.kind === "client");

export function timeoutNodeFor(a: Architecture, targetId: string): ArchNode | undefined {
  return policiesFor(a, targetId, "timeout")[0];
}
export const retryFor = (a: Architecture, targetId: string): ArchNode | undefined => policiesFor(a, targetId, "retry_policy")[0];
export const breakerFor = (a: Architecture, targetId: string): ArchNode | undefined => policiesFor(a, targetId, "circuit_breaker")[0];
export const healthCheckFor = (a: Architecture, targetId: string): ArchNode | undefined => policiesFor(a, targetId, "health_check")[0];

/** Effective timeout (ms) a caller applies when calling `callee`; 0 = none. */
export function effectiveTimeoutMs(a: Architecture, caller: ArchNode, callee: ArchNode): number {
  const t = timeoutNodeFor(a, callee.id);
  if (t && num(t, "timeoutMs") > 0) return num(t, "timeoutMs");
  return num(caller, "requestTimeoutMs");
}

/** Synchronous callers (anything with a sync/data edge into `n`). */
export function syncCallers(a: Architecture, n: ArchNode): ArchNode[] {
  return incoming(a, n.id, "sync").map((c) => a.nodes.find((x) => x.id === c.from)).filter((x): x is ArchNode => !!x);
}

export function accessors(a: Architecture, storeId: string): ArchNode[] {
  const ids = new Set(incoming(a, storeId, "data").map((c) => c.from));
  return a.nodes.filter((n) => ids.has(n.id));
}

export function consumersOf(a: Architecture, queueId: string): ArchNode[] {
  const ids = new Set(outgoing(a, queueId, "async").map((c) => c.to));
  return a.nodes.filter((n) => ids.has(n.id) && (n.kind === "worker" || n.kind === "app_service" || n.kind === "web_app"));
}
export function dlqsOf(a: Architecture, queueId: string): ArchNode[] {
  const ids = new Set(outgoing(a, queueId, "async").map((c) => c.to));
  return a.nodes.filter((n) => ids.has(n.id) && n.kind === "dlq");
}
export function producersOf(a: Architecture, id: string): ArchNode[] {
  const ids = new Set(incoming(a, id, "async", "event", "sync").map((c) => c.from));
  return a.nodes.filter((n) => ids.has(n.id));
}
export function subscribersOf(a: Architecture, topicId: string): ArchNode[] {
  const ids = new Set(outgoing(a, topicId, "event").map((c) => c.to));
  return a.nodes.filter((n) => ids.has(n.id));
}
export function publishersOf(a: Architecture, topicId: string): ArchNode[] {
  const ids = new Set(incoming(a, topicId, "event").map((c) => c.from));
  return a.nodes.filter((n) => ids.has(n.id));
}

/** A cron's duplicate protection only counts when something can actually hold the lock/lease/keys. */
export function cronProtectionEffective(a: Architecture, cron: ArchNode): { effective: boolean; reason: string } {
  const p = str(cron, "duplicateProtection");
  if (p === "none" || p === "") return { effective: false, reason: "No duplicate-run protection is configured." };
  const stores = outgoing(a, cron.id, "data")
    .map((c) => a.nodes.find((n) => n.id === c.to))
    .filter((n): n is ArchNode => !!n && STORE_KINDS.includes(n.kind));
  if (p === "idempotent_job") {
    return stores.some((s) => s.kind === "idempotency_store")
      ? { effective: true, reason: "Idempotent job backed by an Idempotency Store." }
      : { effective: false, reason: "Declared 'idempotent_job' but no Idempotency Store is connected to record executions." };
  }
  return stores.length > 0
    ? { effective: true, reason: `${p === "distributed_lock" ? "Lock" : "Lease"} held in ${stores[0].name}.` }
    : { effective: false, reason: `Declared '${p}' but no shared store is connected to hold the ${p === "distributed_lock" ? "lock" : "lease"}.` };
}

/** Queues that sit between two websocket-serving services (real-time path). */
export function realtimeQueues(a: Architecture): ArchNode[] {
  const isWs = (n: ArchNode | undefined) => !!n && n.kind === "app_service" && str(n, "transport") === "websocket";
  return a.nodes.filter(
    (q) =>
      q.kind === "queue" &&
      incoming(a, q.id, "async").some((c) => isWs(a.nodes.find((n) => n.id === c.from))) &&
      outgoing(a, q.id, "async").some((c) => isWs(a.nodes.find((n) => n.id === c.to)))
  );
}

/** Edge-layer nodes sitting directly behind a client. */
export const isEdgeKind = (k: Kind): boolean => EDGE_KINDS.includes(k);

/** Is there a directed connection chain through the listed kind alternatives? */
export function chainExists(a: Architecture, chain: Kind[][]): boolean {
  if (chain.length === 0) return true;
  const step = (curIds: string[], i: number): boolean => {
    if (i === chain.length) return true;
    const next = new Set<string>();
    for (const id of curIds) for (const c of outgoing(a, id)) next.add(c.to);
    const matches = a.nodes.filter((n) => next.has(n.id) && chain[i].includes(n.kind)).map((n) => n.id);
    return matches.length > 0 && step(matches, i + 1);
  };
  const starts = a.nodes.filter((n) => chain[0].includes(n.kind)).map((n) => n.id);
  return starts.length > 0 && step(starts, 1);
}

/** Is `to` (any of kinds) reachable from any of `from` kinds along any connection? */
export function pathExists(a: Architecture, from: Kind[], to: Kind[]): boolean {
  const starts = a.nodes.filter((n) => from.includes(n.kind));
  for (const s of starts) {
    const seen = new Set<string>([s.id]);
    const stack = [s.id];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const c of outgoing(a, cur)) {
        if (seen.has(c.to)) continue;
        seen.add(c.to);
        const n = a.nodes.find((x) => x.id === c.to);
        if (n && to.includes(n.kind)) return true;
        stack.push(c.to);
      }
    }
  }
  return false;
}

/** Sum of instances across nodes of the given kinds. */
export const totalInstances = (a: Architecture, ...kinds: Kind[]): number =>
  a.nodes.filter((n) => kinds.includes(n.kind)).reduce((s, n) => s + Math.max(1, num(n, "instances", 1)), 0);
