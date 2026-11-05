/**
 * DataNova Campaign 08 — Unified Information Architecture Type Contracts
 *
 * One Product · One Orchestrator · One Understandable Workflow
 */

export type PrimaryDestination = "home" | "workspace" | "evidence";

export type WorkspaceSubView =
  | "overview"
  | "map"
  | "analyze"
  | "investigate"
  | "improve";

export type EvidenceSubView =
  | "findings"
  | "sources"
  | "evidence"
  | "reviews"
  | "exchange"
  | "quality";

export type SpecialistRole =
  | "architecture"
  | "runtime"
  | "reliability"
  | "security"
  | "change"
  | "evidence"
  | "validation";

export interface SpecialistInfo {
  id: SpecialistRole;
  name: string;
  role: string;
  description: string;
  iconName: string;
}

export interface OrchestrationTask {
  id: string;
  specialist: SpecialistRole;
  task: string;
  status: "pending" | "running" | "completed" | "failed";
  durationMs?: number;
  outputSummary?: string;
  evidenceRefs: string[];
}

export interface OrchestrationStep {
  id: string;
  label: string;
  description: string;
  status: "waiting" | "running" | "completed" | "failed";
}

export interface FindingItem {
  id: string;
  title: string;
  plainSummary: string;
  technicalTerm: string;
  severity: "critical" | "warning" | "info";
  affectedComponent: string;
  evidenceRef: string;
  whyItMatters: string;
  recommendedAction: string;
  category: "architecture" | "runtime" | "reliability" | "security" | "change";
}

export interface OrchestrationReport {
  requestId: string;
  timestamp: string;
  userPrompt: string;
  understoodGoal: string;
  scope: {
    projectName: string;
    version: number;
    componentsExamined: string[];
  };
  findings: FindingItem[];
  whyItMatters: string[];
  evidenceLinks: Array<{ label: string; urlOrRef: string; kind: string }>;
  uncertainties: string[];
  recommendedActions: Array<{
    label: string;
    actionType: "investigate" | "navigate_map" | "accept_drift" | "run_simulation" | "request_review";
    targetView?: string;
  }>;
  specialistActivities: OrchestrationTask[];
}

