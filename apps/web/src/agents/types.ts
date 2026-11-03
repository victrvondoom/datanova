/**
 * Multi-Agent Workflow Studio — type contracts (Campaign 07).
 *
 * Every collaborating agent is a DETERMINISTIC rule-based executor over a
 * synthetic case dataset. No LLM or external inference is wired: agents marked
 * with model.kind "deterministic-rules" compute their outputs from structured
 * inputs, and the engine persists every transition before the UI renders it.
 */

export type NodeKind = "agent" | "data" | "policy" | "approval" | "output" | "condition";

export type ToolPermission = "read" | "write" | "none";

export interface ToolRef {
  tool: string;
  adapter: string;
  permission: ToolPermission;
  /** Adapters are connector targets, never assumed-live credentials. */
  configured: boolean;
}

export interface AgentSpec {
  id: string;
  role: string;
  description: string;
  capabilities: string[];
  tools: ToolRef[];
  inputFields: string[];
  outputFields: string[];
  evidenceRequired: string[];
  /** 0 => propose-only: the agent may never finalize a financial action. */
  authorityLimit: { currency: string; max: number };
  timeoutTicks: number;
  retry: { maxRetries: number; backoffTicks: number };
  model: { kind: "deterministic-rules"; version: string };
  memoryScope: "case" | "tenant" | "workflow";
  /** Guidance appended to the agent's instructions (workflow-versioned). */
  guidance?: string;
  /** Supervised mode gates every sensitive agent behind human approval. */
  sensitive?: boolean;
}

export type ConditionOperator = "eq" | "neq" | "gt" | "lt" | "contains";

export interface ConditionSpec {
  /** Artifact field to test, as "<nodeId>.<field>" resolved over upstream artifacts. */
  source: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface WfNode {
  id: string;
  kind: NodeKind;
  label: string;
  agentId?: string;
  /** Parallel-group membership — the engine schedules one wave per depth. */
  group?: string;
  sensitive?: boolean;
  /** Output nodes with external effect are withheld in investigation-only mode. */
  external?: boolean;
  /** Bounded editable configuration (validated before activation). */
  config?: Record<string, string | number | boolean>;
  /** Data-node binding into the case dataset. */
  datasetField?: string;
  approvalPrompt?: string;
  idempotencyKey?: string;
  description?: string;
}

export interface WfEdge {
  id: string;
  from: string;
  to: string;
  kind: "handoff" | "data" | "trigger" | "approval" | "branch";
  label?: string;
  condition?: ConditionSpec;
}

export interface ParallelGroup {
  id: string;
  label: string;
  nodeIds: string[];
}

export type ExecutionMode = "standard" | "supervised" | "investigation" | "simulation" | "red-team";

export interface WorkflowDef {
  id: string;
  name: string;
  version: number;
  description: string;
  objective: string;
  requiredInputs: string[];
  /** Connector adapters the workflow expects; unconfigured ones degrade honestly. */
  toolDependencies: string[];
  nodes: WfNode[];
  edges: WfEdge[];
  parallelGroups: ParallelGroup[];
  expectedArtifacts: string[];
  completionConditions: string[];
  evaluationBenchmark: string;
  defaultMode: ExecutionMode;
}

export interface CaseDataset {
  caseId: string;
  tenantId: string;
  workflowId: string;
  label: string;
  synthetic: true;
  /** Adversarial payload used by red-team mode (prompt-injection defense). */
  injectedInstruction?: string;
  fields: Record<string, unknown>;
}

export type TaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "waiting-agent"
  | "waiting-evidence"
  | "waiting-human"
  | "recovering"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped"
  | "outcome-unknown";

export interface TaskRecord {
  id: string;
  runId: string;
  tenantId: string;
  caseId: string;
  nodeId: string;
  agentId?: string;
  label: string;
  dependencies: string[];
  priority: number;
  status: TaskStatus;
  attempts: number;
  wave?: number;
  startedTick?: number;
  endTick?: number;
  latestOutput?: string;
  nextAction?: string;
  error?: string;
}

export interface Artifact {
  id: string;
  runId: string;
  tenantId: string;
  caseId: string;
  nodeId: string;
  agentId?: string;
  kind: string;
  payload: Record<string, unknown>;
  tick: number;
}

export interface EvidenceRecord {
  id: string;
  runId: string;
  tenantId: string;
  caseId: string;
  nodeId: string;
  agentId?: string;
  /** What the evidence supports — no unverified output becomes trusted memory. */
  claim: string;
  source: string;
  payload: Record<string, unknown>;
  tick: number;
}

export interface Finding {
  id: string;
  runId: string;
  caseId: string;
  nodeId: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  summary: string;
  amount?: { value: number; currency: string };
  evidenceIds: string[];
}

export interface Handoff {
  id: string;
  runId: string;
  tenantId: string;
  caseId: string;
  sourceAgentId: string;
  targetAgentId: string;
  sourceNodeId: string;
  targetNodeId: string;
  taskId: string;
  inputArtifactIds: string[];
  evidenceIds: string[];
  requestedOperation: string;
  requiredOutputFields: string[];
  policyConstraints: string[];
  deadlineTick: number;
  traceId: string;
  tick: number;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  tenantId: string;
  caseId: string;
  nodeId: string;
  prompt: string;
  status: "requested" | "approved" | "rejected";
  decisionTick?: number;
  note?: string;
  decidedBy: "human";
  tick: number;
}

export interface ExternalAction {
  key: string;
  runId: string;
  tenantId: string;
  description: string;
  status: "executed" | "withheld-investigation-only" | "blocked-connector" | "rejected-by-human";
  tick: number;
}

export type WorkflowEventType =
  | "workflow.created" | "workflow.started" | "workflow.paused" | "workflow.resumed"
  | "workflow.completed" | "workflow.failed" | "workflow.cancelled"
  | "agent.started" | "agent.output.created" | "agent.handoff.created" | "agent.failed"
  | "task.queued" | "task.started" | "task.completed" | "task.retry" | "task.failed"
  | "task.blocked" | "task.skipped"
  | "tool.called" | "tool.failed"
  | "evidence.created" | "finding.created"
  | "policy.evaluated"
  | "approval.requested" | "approval.resolved"
  | "action.proposed" | "action.executed" | "action.withheld" | "action.rejected"
  | "action.unknown" | "action.reconciled"
  | "branch.evaluated" | "workflow.validated" | "workflow.validation.rejected";

export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  runId: string;
  tenantId: string;
  caseId: string;
  nodeId?: string;
  agentId?: string;
  tick: number;
  message: string;
  payload?: Record<string, unknown>;
}

export type RunStatus =
  | "pending" | "running" | "paused-approval" | "paused" | "completed" | "failed" | "cancelled";

export interface RunState {
  id: string;
  workflowId: string;
  workflowName: string;
  /** Snapshot of the exact definition version this run executes. */
  defSnapshot: WorkflowDef;
  defVersion: number;
  tenantId: string;
  caseId: string;
  caseLabel: string;
  mode: ExecutionMode;
  status: RunStatus;
  readOnly: boolean;
  startedAtTick: number;
  wave: number;
  tick: number;
  tasks: TaskRecord[];
  artifacts: Artifact[];
  evidence: EvidenceRecord[];
  findings: Finding[];
  handoffs: Handoff[];
  approvals: ApprovalRecord[];
  externalActions: ExternalAction[];
  events: WorkflowEvent[];
  edgeStates: Record<string, "pending" | "delivered" | "inactive">;
  supervisedApproved: string[];
  outcome?: { state: string; summary: string; references: string[] };
  /** Red-team mode: the adversarial payload this run defends against. */
  injectedInstruction?: string;
  /** The exact dataset (with any red-team injection) this run executes against. */
  dataset: CaseDataset;
}

export interface AgentResult {
  ok: boolean;
  /** Structured output artifact payload on success; error details on failure. */
  payload?: Record<string, unknown>;
  evidence?: Array<{ claim: string; source: string; payload?: Record<string, unknown> }>;
  findings?: Array<Omit<Finding, "id" | "runId" | "caseId" | "nodeId" | "evidenceIds"> & { evidenceClaims?: string[] }>;
  summary?: string;
  error?: string;
  retryable?: boolean;
}

export interface ExecContext {
  agent: AgentSpec;
  run: RunState;
  node: WfNode;
  /** Upstream artifacts — the agent consumes structured outputs AND evidence. */
  upstream: Artifact[];
  evidence: EvidenceRecord[];
  dataset: CaseDataset;
  config: Record<string, string | number | boolean>;
  /** Deterministic seeded PRNG — identical runs produce identical results. */
  rng: () => number;
  tick: number;
}
