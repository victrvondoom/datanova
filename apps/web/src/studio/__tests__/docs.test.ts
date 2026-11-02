import { describe, expect, it } from "vitest";
import { RULES } from "../validation";
import { FAILURES } from "../failures";
import { FORMULAS } from "../capacity";
import { SCENARIOS } from "../scenarios";
import { KIND_LIST } from "../model";
import { CHALLENGE_STEPS } from "../challenge";

/** Documentation must describe the implementation: every rule/failure/formula/scenario/component is documented. */
const files = import.meta.glob("../../../../../docs/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const doc = (name: string): string => {
  const hit = Object.entries(files).find(([k]) => k.endsWith(`/docs/${name}`));
  if (!hit) throw new Error(`missing documentation file docs/${name}`);
  return hit[1];
};

describe("documentation matches the implementation", () => {
  it("documents every validation rule", () => {
    const d = doc("architecture-validation-rules.md");
    for (const r of RULES) expect(d, `rule ${r.id}`).toContain(`\`${r.id}\``);
  });
  it("documents every failure", () => {
    const d = doc("failure-injection-model.md");
    for (const f of FAILURES) expect(d, `failure ${f.id}`).toContain(`\`${f.id}\``);
  });
  it("documents every capacity formula", () => {
    const d = doc("capacity-model-assumptions.md");
    for (const f of FORMULAS) { expect(d, `formula ${f.id}`).toContain(`\`${f.id}\``); expect(d).toContain(f.formula); }
  });
  it("documents every scenario, component kind and challenge step", () => {
    const d = doc("architecture-studio-plan.md");
    for (const s of SCENARIOS) expect(d, `scenario ${s.id}`).toContain(`\`${s.id}\``);
    for (const k of KIND_LIST) expect(d, `kind ${k}`).toContain(`\`${k}\``);
    for (const s of CHALLENGE_STEPS) expect(d, `step ${s.title}`).toContain(s.title);
  });
  it("the required documentation set exists and is not empty", () => {
    for (const f of ["architecture-studio-plan.md", "architecture-studio-design.md", "architecture-validation-rules.md", "capacity-model-assumptions.md", "failure-injection-model.md", "architecture-studio-test-report.md", "architecture-studio-build-evidence.md"])
      expect(doc(f).length, f).toBeGreaterThan(500);
  });
});
