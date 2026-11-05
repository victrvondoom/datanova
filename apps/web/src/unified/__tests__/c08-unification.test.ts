/**
 * Campaign 08 — Unified Information Architecture Unit Tests
 *
 * Verifies:
 * - DataNova Multi-Agent Orchestrator engine behavior
 * - Specialist agent task generation & multi-domain routing
 * - Finding reconciliation, impact analysis, and evidence linking
 * - Honest limitations & zero false certainty enforcement
 */

import { describe, it, expect } from "vitest";
import { DataNovaOrchestratorEngine } from "../orchestrator/orchestratorEngine";
import { docflowModel, flawedCheckoutModel } from "../../lab/samples";

describe("Campaign 08: DataNova Multi-Agent Orchestrator", () => {
  const engine = new DataNovaOrchestratorEngine();

  it("1. Routes latency bottleneck prompts to reliability & runtime specialists", () => {
    const report = engine.execute(
      "Investigate why checkout requests are slow",
      docflowModel(),
      "DocFlow System",
      2
    );

    expect(report.understoodGoal).toContain("latency");
    const specialists = report.specialistActivities.map((a) => a.specialist);
    expect(specialists).toContain("architecture");
    expect(specialists).toContain("runtime");
    expect(specialists).toContain("reliability");

    // Findings contain latency bottleneck
    expect(report.findings.some((f) => f.category === "reliability")).toBe(true);
    const bottleneck = report.findings.find((f) => f.category === "reliability");
    expect(bottleneck?.plainSummary).toContain("checkout request time");
    expect(bottleneck?.technicalTerm).toBe("Critical-Path Latency Concentration");
  });

  it("2. Routes undocumented dependency queries to runtime & evidence specialists", () => {
    const report = engine.execute(
      "Find undocumented dependencies in this system",
      docflowModel()
    );

    expect(report.understoodGoal).toContain("discrepancies between declared architecture diagrams and actual");
    const specialists = report.specialistActivities.map((a) => a.specialist);
    expect(specialists).toContain("runtime");
    expect(specialists).toContain("evidence");

    // Findings contain Pricing Service drift
    expect(report.findings.some((f) => f.affectedComponent === "Pricing Service")).toBe(true);
    const drift = report.findings.find((f) => f.affectedComponent === "Pricing Service");
    expect(drift?.severity).toBe("critical");
    expect(drift?.evidenceRef).toContain("calculateDiscount");
  });

  it("3. Routes security boundary prompts to security & validation specialists", () => {
    const report = engine.execute(
      "Check whether this architecture has a security boundary problem",
      flawedCheckoutModel()
    );

    const specialists = report.specialistActivities.map((a) => a.specialist);
    expect(specialists).toContain("security");
    expect(specialists).toContain("validation");

    expect(report.findings.some((f) => f.category === "security")).toBe(true);
    const sec = report.findings.find((f) => f.category === "security");
    expect(sec?.technicalTerm).toBe("Trust Boundary Traversal Violation");
  });

  it("4. Routes change and release queries to change impact specialist", () => {
    const report = engine.execute(
      "Evaluate proposed release changes and breaking API contract diffs",
      docflowModel()
    );

    const specialists = report.specialistActivities.map((a) => a.specialist);
    expect(specialists).toContain("change");

    expect(report.findings.some((f) => f.category === "change")).toBe(true);
    const chg = report.findings.find((f) => f.category === "change");
    expect(chg?.title).toContain("Release Gate Blocked");
  });

  it("5. Honest uncertainty and limitation statements are always included", () => {
    const report = engine.execute("Analyze system health", docflowModel());

    expect(report.uncertainties.length).toBeGreaterThan(0);
    expect(report.uncertainties.some((u) => u.includes("Seed 42"))).toBe(true);
  });

  it("6. Every finding retains why-it-matters and recommended next actions", () => {
    const report = engine.execute("Find undocumented dependencies", docflowModel());

    for (const f of report.findings) {
      expect(f.whyItMatters.length).toBeGreaterThan(10);
      expect(f.recommendedAction.length).toBeGreaterThan(5);
    }
    expect(report.recommendedActions.length).toBeGreaterThan(0);
  });
});

