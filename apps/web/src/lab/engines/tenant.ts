/**
 * Task 24 — Multi-Tenant Isolation Analyzer.
 *
 * Tracks tenant context through the architecture: where it must be
 * established (stores holding tenant-scoped data), where it is propagated
 * (workers touching that data), and which isolation strategy each store
 * uses. Injected failures (missing filter, wrong cache key, lost worker
 * context) produce EXPLICIT violations — never silent cross-tenant success.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";

export type IsolationStrategy = "shared-table" | "schema-per-tenant" | "db-per-tenant" | "none";

export interface TenantRequirement {
  componentId: string;
  kind: "database" | "cache" | "queue" | "worker";
  requiredConfig: string;
  strategy: IsolationStrategy;
}

export function tenantScopedEntities(m: ArchitectureModel) {
  return m.dataEntities.filter((d) => d.tenantScoped);
}

/** Stores/processors that touch tenant-scoped entities and what they must declare. */
export function tenantRequirements(m: ArchitectureModel): TenantRequirement[] {
  const reqs: TenantRequirement[] = [];
  tenantScopedEntities(m).forEach((d) => {
    const holders = [d.ownerComponentId, ...(d.copies ?? []).map((c) => c.componentId)];
    holders.forEach((h) => {
      const c = m.components.find((x) => x.id === h);
      if (!c) return;
      if (c.kind === "database" || c.kind === "objectstore") {
        reqs.push({
          componentId: h, kind: "database",
          requiredConfig: c.config.tenantKey ? "tenantKey (present)" : "tenantKey (MISSING)",
          strategy: c.config.isolationStrategy as IsolationStrategy ?? (c.config.tenantKey ? "shared-table" : "none"),
        });
      } else if (c.kind === "cache") {
        reqs.push({
          componentId: h, kind: "cache",
          requiredConfig: c.config.tenantKeyPrefix ? "tenantKeyPrefix (present)" : "tenantKeyPrefix (MISSING)",
          strategy: c.config.tenantKeyPrefix ? "shared-table" : "none",
        });
      } else if (c.kind === "queue") {
        reqs.push({
          componentId: h, kind: "queue",
          requiredConfig: c.config.tenantKey ? "tenantKey (present)" : "tenantKey (MISSING)",
          strategy: c.config.tenantKey ? "shared-table" : "none",
        });
      } else if (c.kind === "worker") {
        reqs.push({
          componentId: h, kind: "worker",
          requiredConfig: c.config.tenantContext ? "tenantContext (present)" : "tenantContext (MISSING)",
          strategy: c.config.tenantContext ? "shared-table" : "none",
        });
      }
    });
  });
  return reqs;
}

export interface IsolationViolation {
  componentId: string;
  failure: "missing-tenant-filter" | "wrong-cache-key" | "worker-context-loss" | "unknown-strategy";
  consequence: string;
}

/**
 * Task 24.4 — inject tenant-isolation failures: every missing control produces
 * an EXPLICIT violation describing the cross-tenant consequence.
 */
export function injectTenantFailures(m: ArchitectureModel): { violations: IsolationViolation[]; findings: Finding[] } {
  const violations: IsolationViolation[] = [];
  tenantRequirements(m).forEach((r) => {
    if (r.requiredConfig.includes("MISSING")) {
      if (r.kind === "database") {
        violations.push({
          componentId: r.componentId, failure: "missing-tenant-filter",
          consequence: `a query on ${r.componentId} without a tenant filter returns OTHER tenants' rows (simulated violation, explicitly flagged)`,
        });
      } else if (r.kind === "cache") {
        violations.push({
          componentId: r.componentId, failure: "wrong-cache-key",
          consequence: `cache keys without a tenant prefix collide across tenants: tenant B can be served tenant A's cached value`,
        });
      } else if (r.kind === "queue") {
        violations.push({
          componentId: r.componentId, failure: "missing-tenant-filter",
          consequence: `work items in ${r.componentId} carry no tenant identity: a worker can process another tenant's job under the wrong context`,
        });
      } else {
        violations.push({
          componentId: r.componentId, failure: "worker-context-loss",
          consequence: `${r.componentId} loses tenant context mid-processing: writes are attributed to the wrong tenant`,
        });
      }
    }
    if (r.strategy === "none") {
      violations.push({
        componentId: r.componentId, failure: "unknown-strategy",
        consequence: `${r.componentId} holds tenant-scoped data with NO declared isolation strategy`,
      });
    }
  });

  const findings: Finding[] = violations.map((v) => finding(
    "tenant", `tenant:${v.failure}:${v.componentId}`, "critical",
    `Tenant isolation failure: ${v.componentId} (${v.failure.replace(/-/g, " ")})`,
    v.consequence,
    [{ ref: `component:${v.componentId}`, detail: `injected failure: ${v.failure}` }],
  ));
  return { violations, findings };
}

/** Task 24.3 — compare isolation strategies with explicit trade-offs. */
export interface StrategyOption {
  strategy: Exclude<IsolationStrategy, "none">;
  description: string;
  isolationStrength: "weakest" | "medium" | "strongest";
  tradeoff: string;
}

export const STRATEGY_OPTIONS: StrategyOption[] = [
  { strategy: "shared-table", description: "One shared schema; every row/query carries tenant_id",
    isolationStrength: "weakest",
    tradeoff: "cheapest and operationally simplest, but a single missing WHERE clause leaks data; noisy-neighbor risk shared" },
  { strategy: "schema-per-tenant", description: "One schema per tenant in the same database",
    isolationStrength: "medium",
    tradeoff: "schema-level separation without separate infrastructure; migrations must roll out per schema and connection pooling is harder" },
  { strategy: "db-per-tenant", description: "A dedicated datastore per tenant",
    isolationStrength: "strongest",
    tradeoff: "strong isolation and per-tenant restore, but cost and operational overhead scale with tenant count" },
];

export function compareStrategies(): StrategyOption[] {
  return STRATEGY_OPTIONS;
}
