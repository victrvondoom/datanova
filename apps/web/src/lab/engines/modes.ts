/**
 * Task 44 — Expert/Beginner Modes and Accessibility.
 *
 * One engine set, three presentation levels. A learning mode changes ONLY how
 * results are presented (default explanation depth, evidence visibility,
 * assumption surfacing) — never the model, the analysis results, or saved
 * data. The consistency test proves that.
 */

import type { ArchitectureModel, Finding } from "../model";
import type { DetailLevel } from "./explain";
import { explainComponent } from "./explain";
import { critiqueArchitecture } from "./critic";
import { extractGenome } from "./genome";

export type LearningMode = "beginner" | "intermediate" | "expert";

export interface ModeConfig {
  mode: LearningMode;
  /** default explanation level for component explanations */
  explanationLevel: DetailLevel;
  /** whether evidence refs are shown inline (beginners get prose first) */
  showEvidenceInline: boolean;
  /** whether raw engine outputs (metrics, rule ids) are exposed */
  showRawEngineOutput: boolean;
  /** whether assumptions are surfaced prominently */
  surfaceAssumptions: boolean;
  /** guidance text shown in the UI */
  guidance: string;
}

export const MODE_CONFIGS: Record<LearningMode, ModeConfig> = {
  beginner: {
    mode: "beginner",
    explanationLevel: "concise",
    showEvidenceInline: false,
    showRawEngineOutput: false,
    surfaceAssumptions: true,
    guidance: "Essential ideas first. Every result still has an 'inspect evidence' action — nothing is hidden, just ordered.",
  },
  intermediate: {
    mode: "intermediate",
    explanationLevel: "intermediate",
    showEvidenceInline: true,
    showRawEngineOutput: false,
    surfaceAssumptions: true,
    guidance: "Requirements, causal paths, and trade-offs with their evidence links.",
  },
  expert: {
    mode: "expert",
    explanationLevel: "advanced",
    showEvidenceInline: true,
    showRawEngineOutput: true,
    surfaceAssumptions: false,
    guidance: "Full engine output: rule ids, metrics, assumption provenance, uncertainty labels.",
  },
};

export function modeConfig(mode: LearningMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/** Presentation filter: which findings are surfaced first in this mode. */
export function presentFindings(mode: LearningMode, findings: Finding[]): { headline: Finding[]; detail: Finding[] } {
  const cfg = modeConfig(mode);
  if (mode === "expert") return { headline: findings, detail: [] };
  const headline = findings.filter((f) => f.severity === "critical" || f.severity === "warning");
  const detail = findings.filter((f) => f.severity === "info");
  return { headline, detail: cfg.showRawEngineOutput ? detail : detail };
}

/**
 * Task 44.5 — mode consistency proof: the underlying analysis is IDENTICAL in
 * every mode. Returns the engine outputs computed once and asserts (by
 * construction of this function) that mode is not an input to any engine.
 */
export function analyzeIndependentOfMode(m: ArchitectureModel): {
  criticFindings: Finding[];
  genomeFingerprint: string;
  explanationText: Record<string, string>;
} {
  // NOTE: no LearningMode parameter — engines cannot see the mode.
  const { findings } = critiqueArchitecture(m);
  return {
    criticFindings: findings,
    genomeFingerprint: extractGenome(m).fingerprint,
    explanationText: Object.fromEntries(
      m.components.map((c) => [c.id, explainComponent(m, c.id, "intermediate")?.text ?? ""]),
    ),
  };
}
