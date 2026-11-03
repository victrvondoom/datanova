/**
 * Campaign 03, Milestone 5 tests — trust boundaries (T21), data lineage (T22),
 * authorization flow (T23), tenant isolation (T24), adversarial paths (T25).
 */

import { describe, it, expect } from "vitest";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { crossings, analyzeBoundaries } from "../engines/trust";
import { analyzeLineage, lineage, exposureAnalysis, retentionAnalysis } from "../engines/lineage";
import { decide, enforcementPoints, enforcementGaps, leastPrivilegeReview } from "../engines/authz";
import { tenantRequirements, injectTenantFailures, compareStrategies } from "../engines/tenant";
import { reviewAdversarially, THREAT_LIBRARY } from "../engines/adversarial";

// ---------------------------------------------------------------------------
// Task 21 — trust boundaries
// ---------------------------------------------------------------------------

describe("T21 trust-boundary mapper", () => {
  it("enumerates zone crossings with trust direction", () => {
    const cr = crossings(docflowModel());
    const webGw = cr.find((c) => c.connectionId === "cn-web-gw")!;
    expect(webGw.fromZone?.trust).toBe("internet");
    expect(webGw.toZone?.trust).toBe("dmz");
    expect(webGw.trustDelta).toBe(1);
    expect(cr.find((c) => c.connectionId === "cn-worker-notify")?.trustDelta).toBe(-2); // trusted -> internet
    expect(cr.length).toBeGreaterThan(5);
  });

  it("flags unauthenticated internet entry, unprotected privileged access, and unencrypted egress", () => {
    const { findings } = analyzeBoundaries(docflowModel());
    expect(findings.find((f) => f.id === "trust-inbound:cn-web-gw")?.severity).toBe("critical");
    expect(findings.find((f) => f.id === "trust-privileged:cn-worker-db")?.severity).toBe("critical");
    expect(findings.find((f) => f.id === "trust-outbound:cn-worker-notify")?.severity).toBe("critical");
    // the DMZ->app edge is properly controlled: no finding
    expect(findings.find((f) => f.id.startsWith("trust-inbound:cn-gw-up"))).toBeUndefined();
  });

  it("accepts documented exceptions as intentional", () => {
    const m = docflowModel();
    m.connections.find((c) => c.id === "cn-worker-notify")!.securityNote =
      "Notifier receives only document ids and recipient emails over TLS via the provider SDK (reviewed 2026-01).";
    const { findings } = analyzeBoundaries(m);
    const exception = findings.find((f) => f.id === "trust-exception:cn-worker-notify");
    expect(exception?.severity).toBe("info");
    expect(exception?.detail).toContain("reviewed");
    expect(findings.find((f) => f.id === "trust-outbound:cn-worker-notify")).toBeUndefined();
  });

  it("the flawed fixture exposes an uncontrolled payment crossing", () => {
    const { findings } = analyzeBoundaries(flawedCheckoutModel());
    expect(findings.find((f) => f.id === "trust-outbound:k-2")?.title).toContain("c-pay");
  });
});

// ---------------------------------------------------------------------------
// Task 22 — data lineage and privacy exposure
// ---------------------------------------------------------------------------

describe("T22 data lineage and privacy exposure", () => {
  it("traces holders and downstream flows per entity", () => {
    const m = docflowModel();
    const l = lineage(m, m.dataEntities.find((d) => d.id === "de-meta")!);
    expect(l.nodes.find((n) => n.componentId === "meta-db")?.relation).toBe("owner");
    expect(l.nodes.find((n) => n.componentId === "status-cache")?.relation).toBe("copy");
    expect(l.nodes.find((n) => n.componentId === "meta-db")?.flowsTo).toContain("analytics");
  });

  it("flags sensitive copies without a documented purpose", () => {
    const m = docflowModel();
    m.dataEntities.find((d) => d.id === "de-doc")!.copies!.push({ componentId: "analytics", purpose: "" });
    const { exposures, findings } = exposureAnalysis(m);
    expect(exposures.some((e) => e.componentId === "analytics" && e.reason.includes("no documented purpose"))).toBe(true);
    expect(findings[0].severity).toBe("critical");
  });

  it("detects copies missing from the deletion workflow and accepts TTL-bound caches", () => {
    const findings = retentionAnalysis(docflowModel());
    // status-cache self-expires via TTL: documented as acceptable
    expect(findings.find((f) => f.id === "lineage-retention-ok:de-meta:status-cache")?.severity).toBe("info");
    // meta-db and doc-store are not touched by the (only client-edge) delete operation
    expect(findings.find((f) => f.id === "lineage-retention:de-meta:meta-db")?.severity).toBe("warning");
    expect(findings.find((f) => f.id === "lineage-retention:de-doc:doc-store")?.severity).toBe("warning");
  });

  it("combines lineage + findings", () => {
    const { lineages, findings } = analyzeLineage(docflowModel());
    expect(lineages.length).toBe(3);
    expect(findings.length).toBeGreaterThan(2);
  });
});

// ---------------------------------------------------------------------------
// Task 23 — authorization flow
// ---------------------------------------------------------------------------

describe("T23 authorization policy simulator", () => {
  it("decides with deny-overrides-allow and default deny", () => {
    const p = docflowModel().policies!;
    expect(decide(p, "tenant-user", "read", "de-meta").decision).toBe("allow");
    expect(decide(p, "anonymous", "read", "de-meta").decision).toBe("deny");
    expect(decide(p, "tenant-user", "write", "de-meta").decision).toBe("default-deny"); // least privilege
    expect(decide(p, "tenant-user", "delete", "de-doc").matched[0].id).toBe("pol-3");
  });

  it("maps enforcement responsibility to the enforcing component", () => {
    const eps = enforcementPoints(docflowModel());
    expect(eps.length).toBe(1);
    expect(eps[0]).toMatchObject({ enforcer: "gateway", target: "upload-svc" });
  });

  it("detects sensitive client-facing operations without authorization", () => {
    const m = docflowModel();
    m.connections.find((c) => c.id === "cn-gw-up")!.controls = ["authn", "ratelimit"]; // authz removed
    const { gaps, findings } = enforcementGaps(m);
    expect(gaps.some((g) => g.operationId === "op-upload" && g.entityId === "de-doc")).toBe(true);
    expect(findings[0].severity).toBe("critical");
    // the untouched model has no gaps: the gateway enforces authz on the upload path
    expect(enforcementGaps(docflowModel()).gaps).toEqual([]);
  });

  it("flags empty policy sets instead of assuming safety", () => {
    const m = docflowModel();
    m.policies = [];
    expect(leastPrivilegeReview(m).find((f) => f.id === "authz-empty")?.severity).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// Task 24 — multi-tenant isolation
// ---------------------------------------------------------------------------

describe("T24 multi-tenant isolation analyzer", () => {
  it("derives tenant requirements from tenant-scoped entities", () => {
    const reqs = tenantRequirements(docflowModel());
    const metaDb = reqs.find((r) => r.componentId === "meta-db")!;
    expect(metaDb.requiredConfig).toContain("tenantKey (present)");
    expect(metaDb.strategy).toBe("shared-table");
    expect(reqs.find((r) => r.componentId === "status-cache")?.requiredConfig).toContain("MISSING");
  });

  it("injected isolation failures produce EXPLICIT violations", () => {
    const { violations, findings } = injectTenantFailures(docflowModel());
    const cache = violations.find((v) => v.failure === "wrong-cache-key");
    expect(cache?.componentId).toBe("status-cache");
    expect(cache?.consequence).toContain("tenant B");
    expect(violations.some((v) => v.failure === "missing-tenant-filter" && v.componentId === "work-queue")).toBe(true);
    expect(violations.some((v) => v.failure === "missing-tenant-filter" && v.componentId === "doc-store")).toBe(true);
    expect(findings.every((f) => f.severity === "critical")).toBe(true);
    expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
  });

  it("compares isolation strategies with explicit trade-offs", () => {
    const opts = compareStrategies();
    expect(opts.map((o) => o.strategy)).toEqual(["shared-table", "schema-per-tenant", "db-per-tenant"]);
    expect(opts[0].isolationStrength).toBe("weakest");
    expect(opts.every((o) => o.tradeoff.length > 20)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 25 — adversarial paths
// ---------------------------------------------------------------------------

describe("T25 adversarial architecture path generator", () => {
  it("covers the six educational abuse scenarios", () => {
    expect(THREAT_LIBRARY.map((s) => s.id)).toEqual([
      "thr-flood", "thr-duplicate", "thr-identity", "thr-queueflood", "thr-depexhaust", "thr-exposure",
    ]);
  });

  it("finds enabling paths in docflow with grounded evidence", () => {
    const { results, findings } = reviewAdversarially(docflowModel());
    const byId = Object.fromEntries(results.map((r) => [r.scenarioId, r]));
    expect(byId["thr-flood"].enabled).toBe(true); // client edge has no ratelimit
    expect(byId["thr-flood"].enablingPaths[0]).toContain("connection:cn-web-gw");
    expect(byId["thr-duplicate"].enabled).toBe(true); // upload-svc mutates without idempotency
    expect(byId["thr-queueflood"].enabled).toBe(true); // queue ingress unbounded
    // mitigated scenarios are NOT flagged: identity is enforced on the upload path
    expect(byId["thr-identity"].enabled).toBe(false);
    expect(findings.every((f) => f.detail.includes("trade-off"))).toBe(true);
  });

  it("the flawed checkout fixture enables flood and duplicates", () => {
    const { results } = reviewAdversarially(flawedCheckoutModel());
    const byId = Object.fromEntries(results.map((r) => [r.scenarioId, r]));
    expect(byId["thr-flood"].enabled).toBe(true);
    expect(byId["thr-duplicate"].enabled).toBe(true);
    expect(byId["thr-queueflood"].enabled).toBe(false); // no queues at all
  });

  it("is pure and local: reviewing produces no external effects (safe by construction)", () => {
    const m = docflowModel();
    const before = JSON.stringify(m);
    reviewAdversarially(m);
    expect(JSON.stringify(m)).toBe(before); // no mutation, no network APIs exist in engines
  });
});
