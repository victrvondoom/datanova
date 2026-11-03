/**
 * Campaign 05 tests — DEP package format (T21-T25, T37, T39), the exchange
 * lifecycle (T26-T30, T32, T33, T40), and package security (T24/T36).
 */

import { describe, it, expect } from "vitest";
import {
  buildDepPackage, serializeDep, validateDep, depDigest, fnv1a32, canonicalJson,
  inspectSensitive, migrateDep, replayDepScenario, IMPORT_LIMITS, DEP_VERSION, DEP_FORMAT,
  type DepPackage, type AuthorInfo, type BuildInput,
} from "../engines/dep";
import {
  draftPackage, markExported, receivePackage, inspectPackage, acceptPackage, rejectPackage,
  addAnnotation, resolveAnnotation, reopenAnnotation, danglingAnnotations,
  buildReviewResponse, validateReviewResponse, responseSummary,
  diffPackages, reconcileResponse,
  appendProvenanceEvent, verifyProvenanceChain, provenanceTimeline,
  deleteExchangeData, emptyExchangeState, ExchangeError,
  type ExchangeState,
} from "../engines/exchange";
import { docflowModel } from "../samples";
import { extractGenome } from "../engines/genome";
import { scenarioTemplate, runScenario } from "../engines/scenario";
import { captureFinding } from "../engines/evidence";
import { critiqueArchitecture } from "../engines/critic";

const at = "2026-11-03T12:00:00Z";
const author: AuthorInfo = { name: "Architect A", email: "a@example.com", organization: "Acme", identity: "self-declared" };

const buildInput = (over: Partial<BuildInput> = {}): BuildInput => {
  const m = docflowModel();
  const s = scenarioTemplate("burst-overload", m, 120);
  const results = runScenario(m, s);
  return {
    model: m,
    archFingerprint: extractGenome(m).fingerprint,
    scenario: s,
    results: results.expectationResults,
    evidence: critiqueArchitecture(m).findings.slice(0, 3)
      .map((f) => captureFinding(f, { createdAt: at, archFingerprint: extractGenome(m).fingerprint })),
    sourceIds: ["src-awstimeouts", "src-little1961"],
    createdBy: author,
    createdAt: at,
    ...over,
  };
};

// ---------------------------------------------------------------------------
// Tasks 21/22 — spec + deterministic export
// ---------------------------------------------------------------------------

describe("T21/T22 DEP format and deterministic export", () => {
  it("builds a package with manifest, stable ids, and required sections", () => {
    const pkg = buildDepPackage(buildInput());
    expect(pkg.format).toBe(DEP_FORMAT);
    expect(pkg.schemaVersion).toBe(DEP_VERSION);
    expect(pkg.packageId).toMatch(/^dep-[0-9a-f]{8}$/);
    expect(pkg.manifest.sections.map((s) => s.path)).toEqual([
      "model.json", "assumptions.json", "scenario.json", "results.json", "evidence.json", "metadata.json",
    ]);
    const sectionJson: Record<string, string> = {
      "model.json": pkg.modelJson,
      "assumptions.json": canonicalJson(pkg.assumptions),
      "scenario.json": canonicalJson(pkg.scenario),
      "results.json": canonicalJson(pkg.results),
      "evidence.json": canonicalJson(pkg.evidence),
      "metadata.json": canonicalJson({ claimIds: pkg.claimIds, sourceIds: pkg.sourceIds, redactions: pkg.redactions, createdBy: pkg.createdBy }),
    };
    for (const s of pkg.manifest.sections) {
      expect(s.checksum).toBe(fnv1a32(sectionJson[s.path]));
      expect(s.byteLength).toBeGreaterThan(0);
      expect(s.algorithm).toBe("fnv1a-32");
    }
  });

  it("identical inputs produce byte-identical exports; content change changes the digest", () => {
    const input = buildInput();
    const a = serializeDep(buildDepPackage(input));
    const b = serializeDep(buildDepPackage(input));
    expect(a).toBe(b);
    const changedInput = buildInput({ createdAt: "2026-11-03T13:00:00Z" });
    expect(depDigest(buildDepPackage(changedInput))).not.toBe(depDigest(buildDepPackage(buildInput())));
  });

  it("round-trips through serialization: export -> validate -> identical payload", () => {
    const input = buildInput();
    const pkg = buildDepPackage(input);
    const verdict = validateDep(serializeDep(pkg));
    expect(verdict.valid).toBe(true);
    expect(verdict.preview).toMatchObject({ packageId: pkg.packageId, components: 10, scenario: true });
    expect(serializeDep(verdict.package_!)).toBe(serializeDep(pkg));
  });

  it("exports without optional data (no scenario, no evidence) still validate", () => {
    const pkg = buildDepPackage(buildInput({ scenario: null, results: [], evidence: [] }));
    const verdict = validateDep(serializeDep(pkg));
    expect(verdict.valid).toBe(true);
    expect(verdict.preview!.scenario).toBe(false);
    expect(verdict.preview!.evidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 23 — integrity and honesty about signatures
// ---------------------------------------------------------------------------

describe("T23 integrity model (checksums detect corruption; signing is explicitly unsupported)", () => {
  it("detects tampering with any manifest section", () => {
    const pkg = buildDepPackage(buildInput());
    const text = serializeDep(pkg);
    const tampered = JSON.parse(text);
    tampered.results = [{ expectationId: "e1", outcome: "pass", detail: "falsified" }];
    const verdict = validateDep(JSON.stringify(tampered));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.join(" ")).toMatch(/checksum mismatch for results\.json/);
    // the original text still validates — tampering did not corrupt the source
    expect(validateDep(text).valid).toBe(true);
  });

  it("detects a truncated payload (missing sections) as schema failure", () => {
    const pkg = buildDepPackage(buildInput());
    const stripped = JSON.parse(serializeDep(pkg));
    delete stripped.evidence;
    const verdict = validateDep(JSON.stringify(stripped));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("missing required field"))).toBe(true);
  });

  it("never claims author authenticity: identity is self-declared metadata only", () => {
    const pkg = buildDepPackage(buildInput());
    expect(pkg.createdBy.identity).toBe("self-declared");
    expect(JSON.stringify(pkg.manifest)).not.toMatch(/signature|authentic/);
  });
});

// ---------------------------------------------------------------------------
// Tasks 24/36 — safe importer + security tests
// ---------------------------------------------------------------------------

describe("T24/T36 safe import (untrusted packages)", () => {
  it("rejects oversized payloads", () => {
    const verdict = validateDep("x".repeat(IMPORT_LIMITS.maxBytes + 1));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems[0]).toMatch(/exceeds/);
    expect(verdict.package_).toBeNull(); // nothing staged
  });

  it("rejects malformed JSON without crashing the parser", () => {
    expect(validateDep("{nope").valid).toBe(false);
    expect(validateDep("").valid).toBe(false);
    expect(validateDep("null").valid).toBe(false);
    expect(validateDep("[1,2,3]").valid).toBe(false);
  });

  it("rejects prototype-pollution keys anywhere in the structure", () => {
    // hand-written JSON: an object literal `{ __proto__: ... }` in JS source
    // would set the prototype and never reach the serialized text
    const malicious =
      "{\"format\":\"datanova-evidence-package\",\"schemaVersion\":1,\"packageId\":\"dep-x\",\"createdAt\":\"" + at +
      "\",\"createdBy\":{\"name\":\"x\",\"identity\":\"self-declared\"},\"modelJson\":\"{}\",\"manifest\":{\"format\":\"datanova-evidence-package\",\"schemaVersion\":1,\"packageId\":\"dep-x\",\"createdAt\":\"" + at +
      "\",\"sections\":[]},\"assumptions\":[],\"results\":[],\"evidence\":[],\"claimIds\":[],\"sourceIds\":[],\"redactions\":[],\"__proto__\":{\"evil\":true}}";
    const verdict = validateDep(malicious);
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("prototype-pollution"))).toBe(true);
  });

  it("rejects unknown top-level keys (strict schema) and unknown sources", () => {
    const pkg = buildDepPackage(buildInput());
    const stretched = JSON.parse(serializeDep(pkg));
    stretched.surprise = "unknown field";
    let verdict = validateDep(JSON.stringify(stretched));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("unknown top-level key"))).toBe(true);
    const badSources = JSON.parse(serializeDep(pkg));
    badSources.sourceIds = ["src-fake"];
    verdict = validateDep(JSON.stringify(badSources));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("unregistered source"))).toBe(true);
  });

  it("rejects newer schema versions safely with recovery guidance", () => {
    const pkg = buildDepPackage(buildInput());
    const future = JSON.parse(serializeDep(pkg));
    future.schemaVersion = 99;
    const verdict = validateDep(JSON.stringify(future));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems[0]).toMatch(/newer than supported|upgrade Datanova/);
  });

  it("rejects packages whose embedded model fails canonical validation", () => {
    const pkg = buildDepPackage(buildInput());
    const broken = JSON.parse(serializeDep(pkg));
    broken.modelJson = JSON.stringify({ id: "x", components: "not-a-list" });
    const verdict = validateDep(JSON.stringify(broken));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("canonical validation"))).toBe(true);
  });

  it("staged validation never mutates workspace state on failure", () => {
    const pkg = buildDepPackage(buildInput());
    const text = serializeDep(pkg);
    const tampered = JSON.parse(text);
    tampered.results = [{ expectationId: "e", outcome: "pass", detail: "falsified" }];
    const verdict = validateDep(JSON.stringify(tampered));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems.some((p) => p.includes("checksum mismatch"))).toBe(true);
    // nothing to apply: the caller can only stage when valid
    expect(verdict.preview).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 25 — privacy redaction
// ---------------------------------------------------------------------------

describe("T25 privacy-preserving redaction", () => {
  it("excludes the author email by default and records the redaction", () => {
    const pkg = buildDepPackage(buildInput());
    expect(pkg.createdBy.email).toBeUndefined();
    expect(pkg.redactions.some((r) => r.includes("createdBy.email"))).toBe(true);
  });

  it("inspects sensitive content before export (emails, credential-like keys)", () => {
    const pkg = buildDepPackage(buildInput(), { includeEmail: true });
    const findings = inspectSensitive(pkg);
    expect(findings.some((f) => f.field === "createdBy.email")).toBe(true);
    const credentialed = { ...pkg, modelJson: pkg.modelJson.replace("connPool", "apiKey") };
    expect(inspectSensitive(credentialed).some((f) => f.reason.includes("credential"))).toBe(true);
  });

  it("redaction preserves technical reproducibility (model + scenario intact)", () => {
    const redacted = buildDepPackage(buildInput());
    const included = buildDepPackage(buildInput(), { includeEmail: true });
    expect(redacted.modelJson).toBe(included.modelJson);
    expect(redacted.scenario).toEqual(included.scenario);
  });
});

// ---------------------------------------------------------------------------
// Tasks 26/28/40 — exchange lifecycle and retention
// ---------------------------------------------------------------------------

describe("T26/T28/T40 inbox/outbox lifecycle", () => {
  const pkg = buildDepPackage(buildInput());

  it("drafts and exports in the outbox with full action history", () => {
    let state = emptyExchangeState("Architect A");
    state = draftPackage(state, pkg, at);
    expect(state.items[0].status).toBe("drafted");
    state = markExported(state, pkg.packageId, at);
    const item = state.items.find((i) => i.packageId === pkg.packageId)!;
    expect(item.status).toBe("exported");
    expect(item.actions.map((a) => a.action)).toEqual(["draft", "export"]);
  });

  it("receiving is staged: received -> inspected -> accepted, never auto-applied", () => {
    let state = emptyExchangeState("Reviewer B");
    state = receivePackage(state, pkg, at);
    expect(state.items[0].status).toBe("received");
    state = inspectPackage(state, pkg.packageId, at);
    state = acceptPackage(state, pkg.packageId, at);
    expect(state.items[0].status).toBe("accepted");
    expect(state.items[0].actions.map((a) => a.action)).toEqual(["receive", "inspect", "accept"]);
  });

  it("enforces the legal status transitions (invalid sequences throw)", () => {
    let state = emptyExchangeState("Reviewer B");
    state = receivePackage(state, pkg, at);
    expect(() => acceptPackage(state, pkg.packageId, at)).toThrow(ExchangeError); // must inspect first
    state = rejectPackage(state, pkg.packageId, at);
    expect(() => acceptPackage(state, pkg.packageId, at)).toThrow(ExchangeError); // rejected is terminal
  });

  it("rejects receiving the same package twice", () => {
    let state = emptyExchangeState();
    state = receivePackage(state, pkg, at);
    expect(() => receivePackage(state, pkg, at)).toThrow(/already received/);
  });

  it("deletion removes inbox data but preserves outbox attribution history by default", () => {
    const out = buildDepPackage(buildInput({ createdBy: { name: "A", identity: "self-declared" } }));
    let state = emptyExchangeState();
    state = draftPackage(state, out, at);
    state = receivePackage(state, pkg, at);
    const res = deleteExchangeData(state, pkg.packageId);
    expect(res.state.items.map((i) => i.packageId)).toEqual([out.packageId]);
    expect(res.removed).toMatchObject({ packageId: pkg.packageId });
    const keepOut = deleteExchangeData(res.state, out.packageId);
    expect(keepOut.state.items.length).toBe(1); // outbox kept by default
    const gone = deleteExchangeData(res.state, out.packageId, { alsoOutboxHistory: true });
    expect(gone.state.items.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 29 — annotations
// ---------------------------------------------------------------------------

describe("T29 reviewer annotations", () => {
  const pkg = buildDepPackage(buildInput());
  const base = (): ExchangeState => receivePackage(emptyExchangeState(), pkg, at);

  it("annotates specific targets without touching the received package", () => {
    let state = base();
    state = addAnnotation(state, pkg.packageId, {
      target: "component:meta-db", comment: "Why single writer? R-3 style constraints?", author: "B", createdAt: at,
    });
    state = addAnnotation(state, pkg.packageId, {
      target: "evidence:ev-1", comment: "This finding assumes retryMax>0 — is that stated?", author: "B", createdAt: at,
    });
    expect(state.items[0].annotations.length).toBe(2);
    expect(state.items[0].package_).toEqual(pkg); // immutable
  });

  it("rejects malformed targets and empty comments", () => {
    let state = base();
    expect(() => addAnnotation(state, pkg.packageId, { target: "javascript:alert(1)" as never, comment: "x", author: "B", createdAt: at })).toThrow(/invalid annotation target/);
    expect(() => addAnnotation(state, pkg.packageId, { target: "component:meta-db", comment: "", author: "B", createdAt: at })).toThrow(/too short/);
  });

  it("supports resolve, reopen, and response history", () => {
    let state = base();
    state = addAnnotation(state, pkg.packageId, { target: "component:meta-db", comment: "Question?", author: "B", createdAt: at });
    const annId = state.items[0].annotations[0].id;
    state = resolveAnnotation(state, annId, at, "A", "single-writer keeps inventory consistent");
    state = reopenAnnotation(state, annId, at, "B", "but what about partition tolerance?");
    const ann = state.items[0].annotations[0];
    expect(ann.status).toBe("reopened");
    expect(ann.responses.length).toBe(2);
  });

  it("detects dangling annotations (missing targets) after package changes", () => {
    let state = base();
    state = addAnnotation(state, pkg.packageId, { target: "component:no-such", comment: "where is this?", author: "B", createdAt: at });
    expect(danglingAnnotations(state.items[0]).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 30 — review responses
// ---------------------------------------------------------------------------

describe("T30 review response packages", () => {
  const pkg = buildDepPackage(buildInput());

  it("builds a response bound to the exact source digest", () => {
    let state = receivePackage(emptyExchangeState(), pkg, at);
    state = addAnnotation(state, pkg.packageId, { target: "component:meta-db", comment: "justify single writer", author: "B", createdAt: at });
    const response = buildReviewResponse(
      pkg, { name: "B", identity: "self-declared" }, state.items[0].annotations,
      "request-changes",
      [{ claimId: "claim-causal-rules", reason: "the retry magnitude is asserted, not derived" }],
      [{ target: "component:meta-db", suggestion: "document the single-writer rationale in an ADR" }],
      at,
    );
    expect(response.responseTo).toEqual({ packageId: pkg.packageId, digest: depDigest(pkg), schemaVersion: 1 });
    expect(response.verdict).toBe("request-changes");
    const summary = responseSummary(response);
    expect(summary).toMatchObject({ totalAnnotations: 1, open: 1, disputedClaims: ["claim-causal-rules"], corrections: 1 });
  });

  it("imports cleanly against the original package and fails against a changed one", () => {
    const response = buildReviewResponse(pkg, { name: "B", identity: "anonymous" }, [], "approve", [], [], at);
    const text = JSON.stringify(response);
    expect(validateReviewResponse(text, pkg).valid).toBe(true);
    const changed = buildDepPackage(buildInput({ createdAt: "2026-11-03T14:00:00Z" }));
    const bad = validateReviewResponse(text, changed);
    expect(bad.valid).toBe(false);
    expect(bad.problems.some((p) => p.includes("digest does not match"))).toBe(true);
  });

  it("rejects malformed responses (wrong format, invalid verdict, missing reviewer)", () => {
    expect(validateReviewResponse("{}", pkg).valid).toBe(false);
    const r = JSON.parse(JSON.stringify(buildReviewResponse(pkg, { name: "B", identity: "anonymous" }, [], "approve", [], [], at)));
    r.verdict = "maybe";
    expect(validateReviewResponse(JSON.stringify(r), pkg).valid).toBe(false);
    const r2 = JSON.parse(JSON.stringify(r));
    r2.verdict = "approve";
    r2.reviewer = { name: "" };
    expect(validateReviewResponse(JSON.stringify(r2), pkg).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 31 — semantic diff
// ---------------------------------------------------------------------------

describe("T31 semantic package diff", () => {
  // one shared input so variants differ ONLY in the mutated parts
  const shared = buildInput();
  const variant = (over: Partial<BuildInput> = {}): DepPackage => buildDepPackage({ ...shared, ...over });
  const queueMutated = () => {
    const m = docflowModel();
    m.components = m.components.map((c) => c.id === "work-queue" ? { ...c, config: { ...c.config, capacity: 500 } } : c);
    return m;
  };

  it("distinguishes topology/property/assumption/evidence/result changes by stable ids", () => {
    const a = variant();
    const b = variant({
      model: queueMutated(),
      evidence: shared.evidence?.slice(1) ?? [],
    });
    const diffs = diffPackages(a, b);
    expect(diffs.some((d) => d.change === "changed" && d.category === "properties" && d.target.includes("work-queue"))).toBe(true);
    expect(diffs.some((d) => d.category === "evidence" && d.change === "removed")).toBe(true);
  });

  it("reordered content is not a diff (stable ids, not serialization order)", () => {
    const a = variant();
    const shuffled: DepPackage = {
      ...a,
      evidence: [...a.evidence].reverse(),
      results: [...a.results].reverse(),
      sourceIds: [...a.sourceIds].reverse(),
    };
    expect(diffPackages(a, shuffled)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 32 — reconciliation
// ---------------------------------------------------------------------------

describe("T32 conflict-aware reconciliation", () => {
  const shared = buildInput();
  const variant = (over: Partial<BuildInput> = {}): DepPackage => buildDepPackage({ ...shared, ...over });

  it("flags conflicts when the author changed elements the reviewer annotated", () => {
    const original = variant();
    const response = buildReviewResponse(
      original, { name: "B", identity: "self-declared" },
      [{ id: "ann-1", target: "component:work-queue", comment: "capacity?", author: "B", createdAt: at, status: "open", responses: [] }],
      "request-changes", [], [], at,
    );
    const current = variant({
      model: (() => { const m = docflowModel(); m.components = m.components.map((c) => c.id === "work-queue" ? { ...c, config: { ...c.config, capacity: 2000 } } : c); return m; })(),
    });
    const rec = reconcileResponse(original, current, response);
    expect(rec.safe).toBe(false);
    expect(rec.conflicts.length).toBe(1);
    expect(rec.conflicts[0].options).toContain("preserve-local");
    expect(rec.conflicts[0].consequence).toMatch(/newer local work/);
  });

  it("no conflicts when the author's work is unchanged since review", () => {
    const original = variant();
    const response = buildReviewResponse(
      original, { name: "B", identity: "anonymous" },
      [{ id: "ann-1", target: "component:meta-db", comment: "single writer?", author: "B", createdAt: at, status: "open", responses: [] }],
      "request-changes", [], [], at,
    );
    const rec = reconcileResponse(original, variant(), response);
    expect(rec.safe).toBe(true);
    expect(rec.conflicts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 33 — provenance chain
// ---------------------------------------------------------------------------

describe("T33 provenance chain across users", () => {
  const pkg = buildDepPackage(buildInput());
  const digest = depDigest(pkg);

  it("records an append-only, verifiable chain from authoring to acceptance", () => {
    let chain: Parameters<typeof appendProvenanceEvent>[0] = [];
    chain = appendProvenanceEvent(chain, { type: "authored", at, actor: "A", packageId: pkg.packageId, digest, note: "DocFlow review package" });
    chain = appendProvenanceEvent(chain, { type: "exported", at, actor: "A", packageId: pkg.packageId, digest, note: "shared with B" });
    chain = appendProvenanceEvent(chain, { type: "imported", at, actor: "B", packageId: pkg.packageId, digest, note: "received" });
    chain = appendProvenanceEvent(chain, { type: "accepted", at, actor: "B", packageId: pkg.packageId, digest, note: "staged adoption approved" });
    expect(chain.map((e) => e.type)).toEqual(["authored", "exported", "imported", "accepted"]);
    expect(verifyProvenanceChain(chain, [{ packageId: pkg.packageId, digest }])).toEqual([]);
    expect(provenanceTimeline(chain).length).toBe(4);
    expect(provenanceTimeline(chain)[2]).toMatch(/B imported package/);
  });

  it("detects broken chains and unknown package references", () => {
    let chain: Parameters<typeof appendProvenanceEvent>[0] = [];
    chain = appendProvenanceEvent(chain, { type: "authored", at, actor: "A", packageId: pkg.packageId, digest, note: "" });
    const broken = [...chain.slice(0), { ...chain[0], id: "prov-9", prev: "prov-77", type: "corrected" as const, at, actor: "A", packageId: "dep-unknown", digest: "deadbeef", note: "" }];
    const problems = verifyProvenanceChain(broken, [{ packageId: pkg.packageId, digest }]);
    expect(problems.some((p) => p.problem.includes("broken prev link"))).toBe(true);
    expect(problems.some((p) => p.problem.includes("unknown package version"))).toBe(true);
  });

  it("repeated packages are legal (re-import chains) but keep verifiable links", () => {
    let chain: Parameters<typeof appendProvenanceEvent>[0] = [];
    chain = appendProvenanceEvent(chain, { type: "imported", at, actor: "B", packageId: pkg.packageId, digest, note: "first" });
    chain = appendProvenanceEvent(chain, { type: "imported", at, actor: "C", packageId: pkg.packageId, digest, note: "forwarded" });
    expect(verifyProvenanceChain(chain, [{ packageId: pkg.packageId, digest }])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 37 — migration
// ---------------------------------------------------------------------------

describe("T37 schema migration and compatibility", () => {
  it("v1 packages import without migration (current version) and preserve metadata", () => {
    const pkg = buildDepPackage(buildInput());
    const { migrated, note } = migrateDep(pkg);
    expect(migrated).toBe(pkg);
    expect(note).toMatch(/already at schema version/);
  });

  it("unsupported future versions fail safely with guidance (no partial state)", () => {
    const pkg = buildDepPackage(buildInput());
    const future = JSON.parse(serializeDep(pkg));
    future.schemaVersion = DEP_VERSION + 3;
    const verdict = validateDep(JSON.stringify(future));
    expect(verdict.valid).toBe(false);
    expect(verdict.problems[0]).toMatch(/upgrade Datanova/);
  });

  it("explicitly rejects migration from an unsupported older version", () => {
    const pkg = buildDepPackage(buildInput());
    const ancient = { ...pkg, schemaVersion: 0 };
    expect(() => migrateDep(ancient)).toThrow(/no migration path/);
  });
});

// ---------------------------------------------------------------------------
// Tasks 38/39 — offline review and replay
// ---------------------------------------------------------------------------

describe("T38/T39 offline review and reproducible replay", () => {
  it("replays the packaged scenario from the packaged snapshot deterministically", () => {
    const pkg = buildDepPackage(buildInput());
    const replay1 = replayDepScenario(pkg);
    const replay2 = replayDepScenario(pkg);
    expect(replay1).toEqual(replay2);
    expect(replay1.reproducible).toBe(true);
    expect(replay1.comparisons.length).toBe(pkg.results.length);
    expect(replay1.blocked).toBeUndefined();
  });

  it("records honest differences when the replay diverges from the exported result", () => {
    const pkg = buildDepPackage(buildInput());
    const falsified = buildDepPackage({ ...buildInput(), results: [{ expectationId: pkg.results[0].expectationId, outcome: "fail", detail: "different" }] });
    const replay = replayDepScenario(falsified);
    expect(replay.reproducible).toBe(false);
    expect(replay.differences.length).toBe(1);
  });

  it("reports a blocked state (never invents results) when replay is impossible", () => {
    const noScenario = buildDepPackage(buildInput({ scenario: null, results: [] }));
    expect(replayDepScenario(noScenario).blocked).toMatch(/no scenario/);
    const wrongVersion = buildDepPackage(buildInput());
    const stale = { ...wrongVersion, modelVersion: wrongVersion.modelVersion + 1 } as DepPackage;
    expect(replayDepScenario(stale).blocked).toMatch(/model version mismatch/);
  });
});
