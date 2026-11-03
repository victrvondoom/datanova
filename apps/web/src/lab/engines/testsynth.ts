/**
 * Task 32 — Resilience Test Synthesis Engine.
 *
 * Generates testable resilience properties from architecture semantics
 * (isolation guarantees, idempotency, retry safety, budgets), links them to
 * requirements and components, prioritizes by criticality/blast radius, and
 * executes them against the model — a test never passes by being skipped.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { blastRadius } from "./blastradius";

export type PropertyKind = "isolation" | "idempotency" | "retry-safety" | "budget";

export interface TestableProperty {
  id: string;
  kind: PropertyKind;
  statement: string;
  targetComponentId: string;
  requirementIds: string[];
  operationIds: string[];
}

export interface GeneratedTest {
  id: string;
  property: TestableProperty;
  /** deterministic assertion the model can actually evaluate */
  assertion: (m: ArchitectureModel) => boolean;
  priority: number;
  priorityReason: string;
  /** false = the model cannot evaluate this property (it must NOT silently pass) */
  executable: boolean;
}

/** Task 32.1/32.2 — derive properties from the canonical model. */
export function deriveProperties(m: ArchitectureModel): TestableProperty[] {
  const props: TestableProperty[] = [];
  const criticalOps = m.operations.filter((o) => o.criticality >= 4);

  // isolation: low-criticality component failures must not impact critical operations
  m.components.forEach((c) => {
    // clients excluded: a client failing trivially "impacts" its own operations
    if (["analytics", "external"].includes(c.kind)) {
      const br = blastRadius(m, c.id, "down");
      const protectedOps = criticalOps
        .filter((o) => !br.impactedOperations.some((x) => x.operationId === o.id))
        .map((o) => o.name);
      if (protectedOps.length > 0 && br.impactedOperations.length >= 0) {
        props.push({
          id: `prop-iso-${c.id}`,
          kind: "isolation",
          statement: `Failure of ${c.name} does not impact the critical operations ${protectedOps.join(", ")}`,
          targetComponentId: c.id,
          requirementIds: c.requirementIds,
          operationIds: criticalOps.map((o) => o.id),
        });
      }
    }
  });

  // idempotency: mutating services must be safe under retries
  m.components
    .filter((c) => (c.kind === "service" || c.kind === "worker") &&
      m.connections.some((cn) => cn.from === c.id && (cn.access === "write" || cn.access === "readwrite")))
    .forEach((c) => {
      props.push({
        id: `prop-idem-${c.id}`,
        kind: "idempotency",
        statement: `Duplicate requests to ${c.name} do not create duplicate side effects`,
        targetComponentId: c.id,
        requirementIds: c.requirementIds,
        operationIds: [],
      });
    });

  // retry safety: retries must not amplify beyond reason
  m.components
    .filter((c) => Number(c.config.retryMax ?? 0) > 0)
    .forEach((c) => {
      props.push({
        id: `prop-retry-${c.id}`,
        kind: "retry-safety",
        statement: `Retries from ${c.name} cannot amplify dependency load more than ${1 + Number(c.config.retryMax)}x`,
        targetComponentId: c.id,
        requirementIds: c.requirementIds,
        operationIds: [],
      });
    });

  // budget: SLO-mapped components must stay within their error budget under a
  // modeled single-component outage (checked via blast radius only if evaluable)
  m.slos.forEach((s) => {
    props.push({
      id: `prop-budget-${s.id}`,
      kind: "budget",
      statement: `A single-component outage does not exhaust the ${s.kind} budget of ${s.id}`,
      targetComponentId: s.componentIds[0] ?? "",
      requirementIds: [],
      operationIds: [],
    });
  });
  return props;
}

/** Task 32.3/32.4 — generate executable, prioritized tests. */
export function synthesizeTests(m: ArchitectureModel): GeneratedTest[] {
  const critical = new Set(m.operations.filter((o) => o.criticality >= 4).map((o) => o.id));
  return deriveProperties(m).map((p) => {
    const br = blastRadius(m, p.targetComponentId || m.components[0]?.id, "down");
    const touchesCritical = br.impactedOperations.some((o) => critical.has(o.operationId));
    switch (p.kind) {
      case "isolation": {
        const assertion = (mm: ArchitectureModel): boolean => {
          const r = blastRadius(mm, p.targetComponentId, "down");
          return !r.impactedOperations.some((o) => critical.has(o.operationId));
        };
        return {
          id: `test-${p.id}`, property: p, assertion,
          priority: touchesCritical ? 5 : 3,
          priorityReason: touchesCritical
            ? "the component currently TOUCHES critical operations — this isolation property can fail"
            : "protects critical operations; currently isolated in the model",
          executable: true,
        };
      }
      case "idempotency": {
        const assertion = (mm: ArchitectureModel): boolean =>
          mm.components.find((c) => c.id === p.targetComponentId)?.config.idempotent === true;
        return {
          id: `test-${p.id}`, property: p, assertion,
          priority: 5,
          priorityReason: "duplicate side effects violate FR-1-style correctness requirements",
          executable: true,
        };
      }
      case "retry-safety": {
        const assertion = (mm: ArchitectureModel): boolean => {
          const retries = Number(mm.components.find((c) => c.id === p.targetComponentId)?.config.retryMax ?? 0);
          return retries > 0 && retries <= 3; // amplification bound
        };
        return {
          id: `test-${p.id}`, property: p, assertion,
          priority: 3,
          priorityReason: "retry amplification is bounded in the model at <= 4x",
          executable: true,
        };
      }
      case "budget":
      default: {
        // budget properties need failure-rate inputs the model does not measure
        return {
          id: `test-${p.id}`, property: p,
          assertion: () => false,
          priority: 2,
          priorityReason: "budget exhaustion depends on request-rate measurements the model does not provide",
          executable: false,
        };
      }
    }
  }).sort((a, b) => b.priority - a.priority);
}

export interface TestResult {
  testId: string;
  propertyId: string;
  /** null when the test is not executable — never a fake pass */
  passed: boolean | null;
  note: string;
}

/** Task 32.5 — run the generated tests; non-executable tests are reported, not passed. */
export function runGeneratedTests(m: ArchitectureModel): { results: TestResult[]; findings: Finding[] } {
  const results: TestResult[] = synthesizeTests(m).map((t) => {
    if (!t.executable) {
      return { testId: t.id, propertyId: t.property.id, passed: null, note: "NOT EXECUTABLE within the model: " + t.priorityReason };
    }
    const passed = t.assertion(m);
    return {
      testId: t.id, propertyId: t.property.id, passed,
      note: passed ? `assertion holds in the model — ${t.priorityReason}` : `assertion FAILS in the model — ${t.priorityReason}`,
    };
  });
  const findings: Finding[] = results
    .filter((r) => r.passed === false)
    .map((r) => finding(
      "testsynth", `test-fail:${r.propertyId}`, "critical",
      `Generated resilience test fails: ${r.propertyId}`,
      r.note,
      [{ ref: `test:${r.testId}`, detail: r.note }],
    ));
  return { results, findings };
}
