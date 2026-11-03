/**
 * Infrastructure map — the ACTUAL runtime topology of Datanova. Health is
 * measured, never invented: the API adapter calls the real /api/health
 * endpoint; connector adapters are reported NOT CONNECTED because none are
 * configured. No live inference, no external billing/Slack integrations.
 */

import { checkHealth } from "../api";

export type HealthState = "healthy" | "offline" | "not-connected" | "local";

export interface InfraComponent {
  id: string;
  label: string;
  category: "application" | "backend" | "storage" | "connectors" | "inference";
  state: HealthState;
  detail: string;
  /** How the state is actually known. */
  probe: "http" | "builtin" | "configuration";
  lastCheck: string | null;
  participatesInRuns: boolean;
}

export const INFRA_COMPONENTS: Omit<InfraComponent, "lastCheck">[] = [
  { id: "web", label: "Datanova Web Application (Vite)", category: "application", state: "local", detail: "Running in your browser — this Atlas shell and the Workflow Studio.", probe: "builtin", participatesInRuns: true },
  { id: "orchestrator", label: "Agent Orchestrator (deterministic engine)", category: "application", state: "local", detail: "In-app pure DAG executor: waves, joins, retries, approvals. No LLM calls.", probe: "builtin", participatesInRuns: true },
  { id: "api", label: "FastAPI Backend (/api/health)", category: "backend", state: "offline", detail: "Health probed live via HTTP.", probe: "http", participatesInRuns: false },
  { id: "run-store", label: "Run / Event Store (localStorage)", category: "storage", state: "local", detail: "Persisted runs, events, artifacts and approvals — survives refresh.", probe: "builtin", participatesInRuns: true },
  { id: "evidence", label: "Evidence Store (in-run records)", category: "storage", state: "local", detail: "Structured evidence records with claim + source per agent output.", probe: "builtin", participatesInRuns: true },
  { id: "llm", label: "Live LLM Inference", category: "inference", state: "not-connected", detail: "No inference endpoint configured — agents are deterministic rule executors.", probe: "configuration", participatesInRuns: false },
  { id: "conn-slack", label: "Slack Notification Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
  { id: "conn-lambda", label: "Lambda GPU Billing Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
  { id: "conn-k8s", label: "Kubernetes Records Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
  { id: "conn-wandb", label: "Weights & Biases Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
  { id: "conn-ironclad", label: "Ironclad Contracts Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
  { id: "conn-disputes", label: "External Disputes Connector", category: "connectors", state: "not-connected", detail: "Connector target — no credentials configured.", probe: "configuration", participatesInRuns: false },
];

/** Real health check for HTTP-probed components. */
export const probeInfrastructure = async (): Promise<InfraComponent[]> => {
  const stamp = new Date().toISOString();
  const components = INFRA_COMPONENTS.map((c) => ({ ...c, lastCheck: c.probe === "builtin" || c.probe === "configuration" ? stamp : null }));
  const api = components.find((c) => c.id === "api");
  if (api) {
    try {
      const res = await checkHealth();
      api.state = res.status === "healthy" ? "healthy" : "offline";
      api.detail = `HTTP /api/health → ${res.status}`;
      api.lastCheck = stamp;
    } catch {
      api.state = "offline";
      api.detail = "HTTP /api/health unreachable — API not running";
      api.lastCheck = stamp;
    }
  }
  return components;
};
