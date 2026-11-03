/**
 * Task 42 — Reproducible Architecture Experiment Package.
 *
 * An exportable package containing everything needed to reproduce a
 * deterministic experiment: architecture version, scenario, inputs,
 * assumptions, rules, engine + model versions, and the seed. Import validates
 * integrity, schema versions, and references; malformed data is rejected
 * safely (never executed — packages are pure data).
 */

import {
  type ArchitectureModel, parseModel, serializeModel, MODEL_VERSION,
} from "../model";
import { fromTemplate, runChaos, type ChaosExperiment } from "./chaos";

export const PACKAGE_SCHEMA_VERSION = 1;
export const RULESET_VERSION = "campaign-03-r1";

export interface ExperimentPackage {
  schemaVersion: number;
  packageId: string;
  label: string;
  /** serialized canonical architecture the experiment ran against */
  architecture: string;
  experiment: ChaosExperiment;
  /** assumptions the experiment's conclusions depend on */
  assumptionIds: string[];
  rulesetVersion: string;
  modelVersion: number;
  /** deterministic engines: the seed makes reruns identical */
  seed: number;
  createdAt: string;
}

export class PackageError extends Error {}

export function exportPackage(
  model: ArchitectureModel, experiment: ChaosExperiment, meta: { packageId: string; label: string; createdAt: string; seed: number },
): ExperimentPackage {
  return {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    packageId: meta.packageId,
    label: meta.label,
    architecture: serializeModel(model),
    experiment: JSON.parse(JSON.stringify(experiment)) as ChaosExperiment,
    assumptionIds: model.assumptions.map((a) => a.id),
    rulesetVersion: RULESET_VERSION,
    modelVersion: MODEL_VERSION,
    seed: meta.seed,
    createdAt: meta.createdAt,
  };
}

export function parsePackage(text: string): ExperimentPackage {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new PackageError(`invalid package JSON: ${(e as Error).message}`);
  }
  const p = raw as Partial<ExperimentPackage>;
  if (!p || typeof p !== "object") throw new PackageError("package is not an object");
  if (p.schemaVersion === undefined || p.schemaVersion > PACKAGE_SCHEMA_VERSION) {
    throw new PackageError(`unsupported package schema version ${String(p.schemaVersion)} (supported: ${PACKAGE_SCHEMA_VERSION})`);
  }
  if (!p.architecture || !p.experiment) throw new PackageError("package is missing architecture or experiment");
  // the embedded architecture must itself be a valid canonical model
  try {
    parseModel(p.architecture);
  } catch (e) {
    throw new PackageError(`embedded architecture is invalid: ${(e as Error).message}`);
  }
  if (!p.experiment.id || !p.experiment.targetComponentId) {
    throw new PackageError("experiment is incomplete");
  }
  if (typeof p.seed !== "number") throw new PackageError("package is missing its seed — results would not be reproducible");
  return p as ExperimentPackage;
}

export interface ReproductionResult {
  packageId: string;
  verdict: ChaosOutcome2["verdict"];
  observedImpactedOperations: string[];
  deterministic: true;
  matchesOriginal: boolean | null;
}

// re-use the chaos outcome type without a circular runtime import problem
import type { ChaosOutcome as ChaosOutcome2 } from "./chaos";

/** Task 42.2/42.5 — reproduce the experiment deterministically. */
export function reproducePackage(pkg: ExperimentPackage, original?: ReproductionResult): ReproductionResult {
  const model = parseModel(pkg.architecture);
  const outcome = runChaos(model, pkg.experiment);
  const result: ReproductionResult = {
    packageId: pkg.packageId,
    verdict: outcome.verdict,
    observedImpactedOperations: outcome.observedImpactedOperations,
    deterministic: true,
    matchesOriginal: original === undefined ? null :
      original.verdict === outcome.verdict &&
      original.observedImpactedOperations.join() === outcome.observedImpactedOperations.join(),
  };
  return result;
}

/** Convenience: build + export a canonical template experiment in one step. */
export function packageTemplateExperiment(
  model: ArchitectureModel, template: string, target: string,
  meta: { packageId: string; label: string; createdAt: string; seed: number },
  expectedOps: string[] = [],
): ExperimentPackage {
  const experiment = fromTemplate(`exp-${meta.packageId}`, template, target, expectedOps);
  return exportPackage(model, experiment, meta);
}
