/**
 * Task 43 — Architecture Component Extension SDK.
 *
 * A controlled extension contract for custom components: metadata, config
 * schema, semantics (failure behavior, statefulness), declared analysis
 * capabilities, and documentation. Extensions are DATA — they are never
 * executed, and analyses a component does not support are marked unknown
 * instead of pretending coverage.
 */

import { type Component, type ComponentKind, COMPONENT_KINDS, newId } from "../model";

export type AnalysisCapability =
  "causal" | "blast-radius" | "genome" | "latency" | "consistency" | "ownership" | "trust" | "tenant" | "scorecard";

export interface ExtensionConfigField {
  key: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

export interface ComponentExtension {
  id: string;
  name: string;
  version: string;
  kind: ComponentKind;
  description: string;
  configSchema: ExtensionConfigField[];
  semantics: {
    failureBehavior: "blocks" | "degrades" | "isolated";
    stateful: boolean;
    /** what the component models, e.g. "vector search over stored documents" */
    behavior: string;
  };
  supportedAnalyses: AnalysisCapability[];
  /** explicitly declared NOT supported — engines mark these unknown */
  unsupportedAnalyses: AnalysisCapability[];
  docs: string;
}

export class ExtensionError extends Error {}

export interface ExtensionRegistry {
  extensions: Record<string, ComponentExtension>;
}

export function emptyRegistry(): ExtensionRegistry {
  return { extensions: {} };
}

/** Task 43.1/43.5 — validate an extension definition. */
export function validateExtension(ext: Partial<ComponentExtension>): string[] {
  const problems: string[] = [];
  if (!ext.id || !ext.name) problems.push("id and name are required");
  if (!ext.version || !/^\d+\.\d+\.\d+$/.test(ext.version)) problems.push("version must be semver-like (x.y.z)");
  if (!ext.kind || !COMPONENT_KINDS.includes(ext.kind as ComponentKind)) {
    problems.push(`kind must be one of the canonical kinds: ${COMPONENT_KINDS.join(", ")}`);
  }
  if (!ext.description) problems.push("description is required");
  if (!ext.configSchema) problems.push("configSchema is required (may be empty)");
  if (!ext.semantics || !ext.semantics.behavior) problems.push("semantics.behavior is required — a component without modeled behavior cannot be analyzed");
  if (ext.semantics && !["blocks", "degrades", "isolated"].includes(ext.semantics.failureBehavior)) {
    problems.push("semantics.failureBehavior is invalid");
  }
  if (!ext.docs || ext.docs.length < 20) problems.push("docs must explain the component (>= 20 chars)");
  if (!ext.supportedAnalyses) problems.push("supportedAnalyses is required (may be empty)");
  if (ext.supportedAnalyses && ext.unsupportedAnalyses &&
      ext.supportedAnalyses.some((a) => (ext.unsupportedAnalyses ?? []).includes(a))) {
    problems.push("an analysis cannot be both supported and unsupported");
  }
  return problems;
}

/** Task 43.2 — safe registration (data only, never executed). */
export function registerExtension(registry: ExtensionRegistry, ext: ComponentExtension): ExtensionRegistry {
  const problems = validateExtension(ext);
  if (problems.length > 0) throw new ExtensionError(`invalid extension: ${problems.join("; ")}`);
  if (registry.extensions[ext.id] && registry.extensions[ext.id].version === ext.version) {
    throw new ExtensionError(`extension ${ext.id}@${ext.version} is already registered`);
  }
  return { extensions: { ...registry.extensions, [ext.id]: ext } };
}

/** Instantiate a component from a registered extension. */
export function instantiateExtension(
  registry: ExtensionRegistry, extensionId: string, name: string, config: Record<string, string | number | boolean | null>,
  opts: { requirementIds?: string[]; purpose?: string } = {},
): Component {
  const ext = registry.extensions[extensionId];
  if (!ext) throw new ExtensionError(`unknown extension ${extensionId}`);
  // required config fields must be present
  ext.configSchema.filter((f) => f.required).forEach((f) => {
    if (config[f.key] === undefined) throw new ExtensionError(`missing required config "${f.key}" for ${extensionId}`);
  });
  return {
    id: newId(ext.id), kind: ext.kind, name,
    purpose: opts.purpose ?? ext.description,
    config: { ...config, extensionId: ext.id },
    requirementIds: [...(opts.requirementIds ?? [])],
  };
}

/** Task 43.3 — capability-aware analysis: unknown is explicit, never silent. */
export function analysisSupport(
  registry: ExtensionRegistry, extensionId: string, capability: AnalysisCapability,
): "supported" | "unsupported" | "unknown" {
  const ext = registry.extensions[extensionId];
  if (!ext) return "unknown";
  if (ext.supportedAnalyses.includes(capability)) return "supported";
  if (ext.unsupportedAnalyses.includes(capability)) return "unsupported";
  return "unknown";
}

/** Serialize/parse extensions safely (data round-trip, validation on import). */
export function serializeExtension(ext: ComponentExtension): string {
  return JSON.stringify(ext, null, 2);
}

export function parseExtension(text: string): ComponentExtension {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ExtensionError(`invalid extension JSON: ${(e as Error).message}`);
  }
  const problems = validateExtension(raw as Partial<ComponentExtension>);
  if (problems.length > 0) throw new ExtensionError(`invalid extension: ${problems.join("; ")}`);
  return raw as ComponentExtension;
}
