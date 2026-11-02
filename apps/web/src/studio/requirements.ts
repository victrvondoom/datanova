/**
 * Requirement evidence: a requirement is "evidenced" only when the
 * architecture structurally contains what it needs. The learner's own
 * "addressed / concern" marks are recorded separately and never override this.
 */
import { Architecture, ArchNode, Kind, PropValue, bool, str, nodesOfKind, outgoing } from "./model";
import {
  chainExists,
  consumersOf,
  cronProtectionEffective,
  dlqsOf,
  effectiveTimeoutMs,
  pathExists,
  realtimeQueues,
  syncCallers,
} from "./graph";

export interface Cond {
  key: string;
  op: "eq" | "ne" | "gt" | "in";
  value: PropValue | PropValue[];
}

export type CustomId = "noRealtimeQueue" | "cronProtected" | "fanout2" | "dlqAlerting" | "externalTimeout" | "adr" | "queueHasConsumer";

export type Test =
  | { t: "kind"; kinds: Kind[] }
  | { t: "chain"; chain: Kind[][] }
  | { t: "path"; from: Kind[]; to: Kind[] }
  | { t: "prop"; kinds: Kind[]; where: Cond[] }
  | { t: "guard"; policy: Kind; targets: Kind[]; where?: Cond[] }
  | { t: "anyOf"; tests: Test[] }
  | { t: "allOf"; tests: Test[] }
  | { t: "custom"; id: CustomId };

export interface Need {
  text: string;
  test: Test;
}

export interface Requirement {
  id: string;
  text: string;
  type: "functional" | "non-functional";
  needs: Need[];
  /** Foundations topics (1..20) that teach the relevant concept */
  topics: number[];
  /** structured requirement -> decision map row */
  decision: string;
  reason: string;
  tradeoff: string;
}

export interface EvalContext {
  /** ADR ids linked to the requirement being evaluated (for the 'adr' custom check) */
  linkedAdrCount: number;
}

function condHolds(n: ArchNode, c: Cond): boolean {
  const v = n.props[c.key];
  switch (c.op) {
    case "eq": return v === c.value;
    case "ne": return v !== c.value;
    case "gt": return typeof v === "number" && typeof c.value === "number" && v > c.value;
    case "in": return Array.isArray(c.value) && c.value.includes(v as PropValue);
  }
}

export function evalTest(a: Architecture, test: Test, ctx: EvalContext): boolean {
  switch (test.t) {
    case "kind": return a.nodes.some((n) => test.kinds.includes(n.kind));
    case "chain": return chainExists(a, test.chain);
    case "path": return pathExists(a, test.from, test.to);
    case "prop": return a.nodes.some((n) => test.kinds.includes(n.kind) && test.where.every((c) => condHolds(n, c)));
    case "guard": {
      return a.nodes.some((p) => {
        if (p.kind !== test.policy) return false;
        const target = a.nodes.find((n) => n.id === p.props.target);
        return !!target && test.targets.includes(target.kind) && (test.where ?? []).every((c) => condHolds(p, c));
      });
    }
    case "anyOf": return test.tests.some((x) => evalTest(a, x, ctx));
    case "allOf": return test.tests.every((x) => evalTest(a, x, ctx));
    case "custom": return evalCustom(a, test.id, ctx);
  }
}

function evalCustom(a: Architecture, id: CustomId, ctx: EvalContext): boolean {
  switch (id) {
    case "noRealtimeQueue":
      // satisfied only when a real-time (websocket) service exists AND no queue sits inside its path
      return nodesOfKind(a, "app_service").some((n) => str(n, "transport") === "websocket") && realtimeQueues(a).length === 0;
    case "cronProtected": {
      const crons = nodesOfKind(a, "cron_runner");
      return crons.length > 0 && crons.every((c) => cronProtectionEffective(a, c).effective);
    }
    case "fanout2":
      return nodesOfKind(a, "pubsub", "event_bus").some((t) => outgoing(a, t.id, "event").length >= 2);
    case "dlqAlerting":
      return nodesOfKind(a, "queue").some((q) => dlqsOf(a, q.id).some((d) => bool(d, "alerting")));
    case "externalTimeout": {
      const ext = nodesOfKind(a, "external_service");
      if (ext.length === 0) return false;
      return ext.every((e) => {
        const callers = syncCallers(a, e);
        return callers.length > 0 && callers.every((c) => effectiveTimeoutMs(a, c, e) > 0);
      });
    }
    case "adr":
      return ctx.linkedAdrCount > 0;
    case "queueHasConsumer":
      return nodesOfKind(a, "queue").some((q) => consumersOf(a, q.id).length > 0);
  }
}

export type EvidenceStatus = "evidenced" | "partial" | "missing";

export interface RequirementEvaluation {
  requirementId: string;
  status: EvidenceStatus;
  needs: Array<{ text: string; met: boolean }>;
}

export function evaluateRequirement(a: Architecture, req: Requirement, ctx: EvalContext): RequirementEvaluation {
  const needs = req.needs.map((n) => ({ text: n.text, met: evalTest(a, n.test, ctx) }));
  const met = needs.filter((n) => n.met).length;
  const status: EvidenceStatus = met === needs.length ? "evidenced" : met === 0 ? "missing" : "partial";
  return { requirementId: req.id, status, needs };
}

function collectKinds(t: Test, out: Set<Kind>): void {
  switch (t.t) {
    case "kind": t.kinds.forEach((k) => out.add(k)); break;
    case "chain": t.chain.forEach((l) => l.forEach((k) => out.add(k))); break;
    case "path": [...t.from, ...t.to].forEach((k) => out.add(k)); break;
    case "prop": t.kinds.forEach((k) => out.add(k)); break;
    case "guard": out.add(t.policy); t.targets.forEach((k) => out.add(k)); break;
    case "anyOf": case "allOf": t.tests.forEach((x) => collectKinds(x, out)); break;
    case "custom": break;
  }
}

/** Component kinds related to a requirement (for "see related components"). */
export function relatedKinds(req: Requirement): Kind[] {
  const s = new Set<Kind>();
  req.needs.forEach((n) => collectKinds(n.test, s));
  return [...s];
}

/** kinds any requirement of the scenario names — used by the "unnecessary infrastructure" rule */
export function kindsRequiredBy(reqs: Requirement[]): Set<Kind> {
  const s = new Set<Kind>();
  reqs.forEach((r) => relatedKinds(r).forEach((k) => s.add(k)));
  return s;
}

