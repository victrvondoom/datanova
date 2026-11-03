/**
 * Campaign 05, Tasks 21-25/37/39 — Datanova Evidence Package (DEP) format.
 *
 * A portable, versioned, integrity-checked, privacy-aware exchange unit:
 * architecture snapshot + assumptions + scenario + results + evidence +
 * claim/source metadata. Spec: docs/campaign-05/evidence-exchange-spec.md.
 *
 * SECURITY POSTURE (honest):
 *  - Integrity = corruption detection via deterministic content checksums
 *    (fnv1a-32 over canonical section JSON). A CHECKSUM IS NOT A SIGNATURE:
 *    it detects accidental corruption; a determined attacker can recompute
 *    it. No signing library or key-management exists in this project, so
 *    author authenticity is EXPLICITLY UNSUPPORTED and never claimed.
 *  - Import treats every package as untrusted: strict schema, size/depth/
 *    count limits, allowlisted keys, prototype-pollution scanning, and
 *    staged validation that never touches workspace state until accepted.
 */

import type { ArchitectureModel } from "../model";
import { MODEL_VERSION, parseModel, serializeModel } from "../model";
import type { EvidenceArtifact } from "./evidence";
import type { Scenario, ScenarioRunResult } from "./scenario";
import { runScenario } from "./scenario";
import { SOURCES } from "./sources";
import { CLAIMS } from "./claims";

export const DEP_FORMAT = "datanova-evidence-package";
export const DEP_VERSION = 1;

/** Supported import range: [MIN, CURRENT]. Future versions fail safely. */
export const DEP_MIN_VERSION = 1;

export interface AuthorInfo {
  /** self-declared display name — attribution only, NOT authentication */
  name: string;
  /** excluded by default (privacy) unless explicitly included */
  email?: string;
  organization?: string;
  identity: "self-declared" | "anonymous";
}

export interface DepSectionDigest {
  /** virtual path, e.g. "model.json" — must match /^[\w.-]+\.json$/ */
  path: string;
  mediaType: "application/json";
  byteLength: number;
  /** fnv1a-32 of the canonical section JSON (corruption detection only) */
  checksum: string;
  algorithm: "fnv1a-32";
}

export interface DepManifest {
  format: typeof DEP_FORMAT;
  schemaVersion: number;
  packageId: string;
  createdAt: string;
  sections: DepSectionDigest[];
}

export interface DepPackage {
  format: typeof DEP_FORMAT;
  schemaVersion: number;
  packageId: string;
  createdAt: string;
  createdBy: AuthorInfo;
  /** canonical model version the architecture snapshot validates against */
  modelVersion: number;
  /** genome-style fingerprint of the architecture at export time */
  archFingerprint: string;
  /** serializeModel() output of the canonical model (stable ordering) */
  modelJson: string;
  assumptions: { ref: string; statement: string }[];
  /** the scenario the results were produced from (replayable) */
  scenario: Scenario | null;
  /** expectation results at export time (compared on replay) */
  results: { expectationId: string; outcome: string; detail: string }[];
  evidence: EvidenceArtifact[];
  /** claim registry ids whose statements this package relies on */
  claimIds: string[];
  /** source registry ids cited */
  sourceIds: string[];
  redactions: string[];
  manifest: DepManifest;
}

// ---------------------------------------------------------------------------
// deterministic checksum (corruption detection — NOT a signature)
// ---------------------------------------------------------------------------

export function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts (h * 16777619 mod 2^32)
    h = (h + ((h << 1) >>> 0) + ((h << 4) >>> 0) + ((h << 7) >>> 0) + ((h << 8) >>> 0) + ((h << 24) >>> 0)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Canonical JSON: sorted keys, no insignificant whitespace, undefined omitted — stable bytes. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

const depSections = (p: Omit<DepPackage, "manifest">): { path: string; json: string }[] => [
  { path: "model.json", json: p.modelJson },
  { path: "assumptions.json", json: canonicalJson(p.assumptions) },
  { path: "scenario.json", json: canonicalJson(p.scenario) },
  { path: "results.json", json: canonicalJson(p.results) },
  { path: "evidence.json", json: canonicalJson(p.evidence) },
  { path: "metadata.json", json: canonicalJson({ claimIds: p.claimIds, sourceIds: p.sourceIds, redactions: p.redactions, createdBy: p.createdBy }) },
];

/** Content digest of the full package (stable ordering). */
export function depDigest(p: DepPackage): string {
  return fnv1a32(depSections(p).map((s) => s.path + s.json).join("\u0000"));
}

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** include author email in the package (default false — privacy) */
  includeEmail?: boolean;
  /** include author organization (default true) */
  includeOrganization?: boolean;
}

export interface BuildInput {
  model: ArchitectureModel;
  archFingerprint: string;
  scenario?: Scenario | null;
  results?: ScenarioRunResult["expectationResults"] | { expectationId: string; outcome: string; detail: string }[];
  evidence?: EvidenceArtifact[];
  /** claim/source ids to attach; defaults are derived when omitted */
  claimIds?: string[];
  sourceIds?: string[];
  createdBy: AuthorInfo;
  createdAt: string;
}

export class DepError extends Error {}

/** Build a DEP with deterministic field ordering and a verified manifest. */
export function buildDepPackage(input: BuildInput, options: ExportOptions = {}): DepPackage {
  const modelJson = serializeModel(input.model);
  parseModel(modelJson); // the snapshot must still validate
  const assumptions = input.model.assumptions.map((a) => ({ ref: a.id, statement: a.statement }));
  const claimIds = input.claimIds ?? CLAIMS.filter((c) => c.sources.some((s) => input.sourceIds?.includes(s))).map((c) => c.id);
  const sourceIds = input.sourceIds ?? [];
  const createdBy: AuthorInfo = {
    name: input.createdBy.name || "anonymous",
    email: options.includeEmail ? input.createdBy.email : undefined,
    organization: options.includeOrganization === false ? undefined : input.createdBy.organization,
    identity: input.createdBy.identity ?? "self-declared",
  };
  const partial: Omit<DepPackage, "manifest"> = {
    format: DEP_FORMAT,
    schemaVersion: DEP_VERSION,
    packageId: "pending",
    createdAt: input.createdAt,
    createdBy,
    modelVersion: MODEL_VERSION,
    archFingerprint: input.archFingerprint,
    modelJson,
    assumptions,
    scenario: input.scenario ?? null,
    results: (input.results ?? []).map((r) => ({ expectationId: r.expectationId, outcome: r.outcome, detail: r.detail })),
    evidence: (input.evidence ?? []).map((a) => ({ ...a })),
    claimIds: [...new Set(claimIds)].sort(),
    sourceIds: [...new Set(sourceIds)].sort(),
    redactions: [
      ...(options.includeEmail ? [] : ["createdBy.email (excluded by default)"]),
      ...(input.createdBy.email && options.includeEmail ? [] : []),
    ],
  };
  // packageId is derived from the content so identical content ⇒ identical id
  const digest = fnv1a32(depSections(partial).map((s) => s.path + s.json).join("\u0000"));
  const pkg: DepPackage = {
    ...partial,
    packageId: `dep-${digest.slice(0, 12)}`,
    manifest: {
      format: DEP_FORMAT,
      schemaVersion: DEP_VERSION,
      packageId: `dep-${digest.slice(0, 12)}`,
      createdAt: input.createdAt,
      sections: depSections(partial).map((s) => ({
        path: s.path, mediaType: "application/json" as const,
        byteLength: s.json.length,
        checksum: fnv1a32(s.json),
        algorithm: "fnv1a-32" as const,
      })),
    },
  };
  return pkg;
}

/** Deterministic serialization: identical package ⇒ identical bytes. */
export function serializeDep(p: DepPackage): string {
  return canonicalJson(p);
}

// ---------------------------------------------------------------------------
// privacy inspection (Task 25)
// ---------------------------------------------------------------------------

export interface SensitiveFinding {
  field: string;
  reason: string;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Scan a package for potentially sensitive content BEFORE export. */
export function inspectSensitive(p: DepPackage): SensitiveFinding[] {
  const out: SensitiveFinding[] = [];
  if (p.createdBy.email) out.push({ field: "createdBy.email", reason: "personal email address of the author" });
  if (EMAIL_RE.test(p.modelJson)) out.push({ field: "modelJson", reason: "email-like string inside the architecture model" });
  for (const [i, a] of p.evidence.entries()) {
    if (EMAIL_RE.test(a.summary) || EMAIL_RE.test(a.source)) {
      out.push({ field: `evidence[${i}].summary/source`, reason: "email-like string inside an evidence artifact" });
    }
    if (/password|secret|token|api[-_]?key/i.test(`${a.summary} ${a.source}`)) {
      out.push({ field: `evidence[${i}]`, reason: "credential-like keyword inside an evidence artifact — verify before sharing" });
    }
  }
  if (/password|secret|token|api[-_]?key/i.test(p.modelJson)) {
    out.push({ field: "modelJson.config", reason: "credential-like config key inside the model — verify before sharing" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// safe import (Task 24)
// ---------------------------------------------------------------------------

export const IMPORT_LIMITS = {
  maxBytes: 512 * 1024,
  maxJsonDepth: 16,
  maxEvidence: 200,
  maxAssumptions: 100,
  maxResults: 50,
  maxStringLength: 200_000,
} as const;

export interface ImportVerdict {
  valid: boolean;
  package_: DepPackage | null;
  problems: string[];
  /** what the import WOULD change; empty until validation passed */
  preview: { packageId: string; createdBy: string; components: number; evidence: number; scenario: boolean; claims: number; sources: number } | null;
}

const ALLOWED_KEYS = new Set([
  "format", "schemaVersion", "packageId", "createdAt", "createdBy", "modelVersion",
  "archFingerprint", "modelJson", "assumptions", "scenario", "results", "evidence",
  "claimIds", "sourceIds", "redactions", "manifest",
]);
const AUTHOR_KEYS = new Set(["name", "email", "organization", "identity"]);
const MANIFEST_KEYS = new Set(["format", "schemaVersion", "packageId", "createdAt", "sections"]);

/** Reject __proto__/constructor/prototype anywhere in a parsed structure. */
function scanPrototypePollution(value: unknown, path: string, problems: string[], depth = 0): void {
  if (depth > IMPORT_LIMITS.maxJsonDepth) {
    problems.push(`${path}: JSON nesting exceeds ${IMPORT_LIMITS.maxJsonDepth}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanPrototypePollution(v, `${path}[${i}]`, problems, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        problems.push(`${path}.${k}: prototype-pollution key rejected`);
      }
      scanPrototypePollution(v, `${path}.${k}`, problems, depth + 1);
    }
  }
  if (typeof value === "string" && value.length > IMPORT_LIMITS.maxStringLength) {
    problems.push(`${path}: string exceeds ${IMPORT_LIMITS.maxStringLength} chars`);
  }
}

/**
 * Validate an untrusted package in isolation. Nothing here touches workspace
 * state; the caller stages adoption only when `valid` is true.
 */
export function validateDep(text: string): ImportVerdict {
  const problems: string[] = [];
  const size = typeof text === "string" ? text.length : Number.MAX_SAFE_INTEGER;
  if (size > IMPORT_LIMITS.maxBytes) {
    return { valid: false, package_: null, problems: [`package exceeds ${IMPORT_LIMITS.maxBytes} bytes (got ${size})`], preview: null };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { valid: false, package_: null, problems: [`malformed JSON: ${(e as Error).message}`], preview: null };
  }
  scanPrototypePollution(raw, "root", problems);
  if (problems.length > 0) return { valid: false, package_: null, problems, preview: null };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, package_: null, problems: ["root must be a DEP object"], preview: null };
  }
  const p = raw as Record<string, unknown>;
  if (p.format !== DEP_FORMAT) problems.push(`format must be "${DEP_FORMAT}"`);
  if (typeof p.schemaVersion !== "number" || !Number.isInteger(p.schemaVersion)) {
    return { valid: false, package_: null, problems: ["schemaVersion must be an integer"], preview: null };
  }
  if (p.schemaVersion > DEP_VERSION) {
    return { valid: false, package_: null, problems: [`schemaVersion ${p.schemaVersion} is newer than supported ${DEP_VERSION} — upgrade Datanova to import this package`], preview: null };
  }
  if (p.schemaVersion < DEP_MIN_VERSION) {
    return { valid: false, package_: null, problems: [`schemaVersion ${p.schemaVersion} is below the supported range [${DEP_MIN_VERSION}, ${DEP_VERSION}]`], preview: null };
  }
  for (const k of Object.keys(p)) {
    if (!ALLOWED_KEYS.has(k)) problems.push(`unknown top-level key "${k}" rejected (strict schema)`);
  }
  for (const required of ["packageId", "createdAt", "createdBy", "modelJson", "manifest", "assumptions", "results", "evidence", "claimIds", "sourceIds"]) {
    if (!(required in p)) problems.push(`missing required field "${required}"`);
  }
  if (problems.length > 0) return { valid: false, package_: null, problems, preview: null };

  const author = p.createdBy as Record<string, unknown>;
  for (const k of Object.keys(author)) {
    if (!AUTHOR_KEYS.has(k)) problems.push(`createdBy.${k}: unknown key rejected`);
  }
  if (author.identity !== "self-declared" && author.identity !== "anonymous") {
    problems.push("createdBy.identity must be self-declared or anonymous");
  }
  if (!Array.isArray(p.assumptions) || p.assumptions.length > IMPORT_LIMITS.maxAssumptions) {
    problems.push(`assumptions must be an array of at most ${IMPORT_LIMITS.maxAssumptions}`);
  }
  if (!Array.isArray(p.evidence) || p.evidence.length > IMPORT_LIMITS.maxEvidence) {
    problems.push(`evidence must be an array of at most ${IMPORT_LIMITS.maxEvidence} items`);
  }
  if (!Array.isArray(p.results) || p.results.length > IMPORT_LIMITS.maxResults) {
    problems.push(`results must be an array of at most ${IMPORT_LIMITS.maxResults}`);
  }
  if (typeof p.modelJson !== "string" || p.modelJson.length === 0) problems.push("modelJson must be a non-empty string");
  if (problems.length > 0) return { valid: false, package_: null, problems, preview: null };

  // the embedded architecture must validate against the canonical schema
  let model: ArchitectureModel | null = null;
  try {
    model = parseModel(p.modelJson as string);
  } catch (e) {
    return { valid: false, package_: null, problems: [`embedded model fails canonical validation: ${(e as Error).message}`], preview: null };
  }
  // claim/source references must resolve against the registries
  const knownSources = new Set(SOURCES.map((s) => s.id));
  const knownClaims = new Set(CLAIMS.map((c) => c.id));
  for (const sid of p.sourceIds as string[]) {
    if (!knownSources.has(sid)) problems.push(`sourceIds: unknown source "${sid}" — refusing a package that cites unregistered sources`);
  }
  for (const cid of p.claimIds as string[]) {
    if (!knownClaims.has(cid)) problems.push(`claimIds: unknown claim "${cid}"`);
  }

  // integrity: manifest sections must match recomputed checksums
  const manifest = p.manifest as Record<string, unknown>;
  for (const k of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(k)) problems.push(`manifest.${k}: unknown key rejected`);
  }
  const sections = depSections(p as unknown as Omit<DepPackage, "manifest">);
  const manifestSections = manifest.sections as DepSectionDigest[];
  if (!Array.isArray(manifestSections) || manifestSections.length !== sections.length) {
    problems.push("manifest.sections count mismatch");
  } else {
    sections.forEach((s, i) => {
      const m = manifestSections[i];
      if (m.path !== s.path) problems.push(`manifest.sections[${i}]: path mismatch (${m.path} != ${s.path})`);
      if (m.path && !/^[\w.-]+\.json$/.test(m.path)) problems.push(`manifest.sections[${i}]: unsafe path "${m.path}"`);
      if (m.algorithm !== "fnv1a-32") problems.push(`manifest.sections[${i}]: unsupported checksum algorithm`);
      if (m.checksum !== fnv1a32(s.json)) problems.push(`manifest.sections[${i}]: checksum mismatch for ${s.path} — content corrupted or tampered`);
      if (m.byteLength !== s.json.length) problems.push(`manifest.sections[${i}]: byteLength mismatch for ${s.path}`);
    });
  }
  const pkg = p as unknown as DepPackage;
  if (problems.length > 0) return { valid: false, package_: null, problems, preview: null };
  return {
    valid: true,
    package_: pkg,
    problems: [],
    preview: {
      packageId: pkg.packageId,
      createdBy: `${pkg.createdBy.name} (${pkg.createdBy.identity})`,
      components: model!.components.length,
      evidence: pkg.evidence.length,
      scenario: pkg.scenario !== null,
      claims: pkg.claimIds.length,
      sources: pkg.sourceIds.length,
    },
  };
}

// ---------------------------------------------------------------------------
// migration (Task 37)
// ---------------------------------------------------------------------------

/**
 * Migrate a validated package to the current schema version. v1 is the
 * minimum supported version; the migration chain is explicit and testable.
 * Original metadata is preserved verbatim.
 */
export function migrateDep(pkg: DepPackage): { migrated: DepPackage; note: string } {
  if (pkg.schemaVersion === DEP_VERSION) {
    return { migrated: pkg, note: `already at schema version ${DEP_VERSION}` };
  }
  // future migrations chain here: v1 -> v2 -> ...
  throw new DepError(`no migration path from schema version ${pkg.schemaVersion} to ${DEP_VERSION}`);
}

// ---------------------------------------------------------------------------
// replay (Task 39)
// ---------------------------------------------------------------------------

export interface ReplayOutcome {
  scenarioId: string;
  reproducible: boolean;
  /** per-expectation original vs replayed comparison */
  comparisons: { expectationId: string; original: string; replayed: string; match: boolean }[];
  differences: string[];
  /** why replay was impossible, when it was */
  blocked?: string;
}

/**
 * Replay the packaged scenario against the packaged architecture snapshot.
 * Deterministic: identical package ⇒ identical replay. Version mismatches
 * and missing data produce honest blocked states, never invented results.
 */
export function replayDepScenario(pkg: DepPackage): ReplayOutcome {
  if (!pkg.scenario) {
    return { scenarioId: "(none)", reproducible: false, comparisons: [], differences: [], blocked: "package contains no scenario — nothing to replay" };
  }
  if (pkg.modelVersion !== MODEL_VERSION) {
    return {
      scenarioId: pkg.scenario.id,
      reproducible: false,
      comparisons: [],
      differences: [],
      blocked: `model version mismatch: package built against model v${pkg.modelVersion}, this engine is v${MODEL_VERSION} — results are not comparable`,
    };
  }
  let model: ArchitectureModel;
  try {
    model = parseModel(pkg.modelJson);
  } catch (e) {
    return { scenarioId: pkg.scenario.id, reproducible: false, comparisons: [], differences: [], blocked: `embedded model no longer validates: ${(e as Error).message}` };
  }
  let replay: ScenarioRunResult;
  try {
    replay = runScenario(model, pkg.scenario);
  } catch (e) {
    return { scenarioId: pkg.scenario.id, reproducible: false, comparisons: [], differences: [], blocked: `scenario not compatible with the packaged architecture: ${(e as Error).message}` };
  }
  const comparisons = pkg.results.map((orig) => {
    const again = replay.expectationResults.find((r) => r.expectationId === orig.expectationId);
    const replayed = again?.outcome ?? "missing";
    return { expectationId: orig.expectationId, original: orig.outcome, replayed, match: orig.outcome === replayed };
  });
  const differences = comparisons.filter((c) => !c.match).map((c) => `expectation ${c.expectationId}: original ${c.original}, replayed ${c.replayed}`);
  return {
    scenarioId: pkg.scenario.id,
    reproducible: differences.length === 0 && comparisons.length === pkg.results.length,
    comparisons,
    differences,
  };
}
