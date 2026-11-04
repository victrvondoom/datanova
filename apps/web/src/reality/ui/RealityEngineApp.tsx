/**
 * Campaign 07 — Flagship Product: DataNova Reality Engine UI
 *
 * Workspace shell featuring nested navigation across:
 * - Overview
 * - Ingestion Center
 * - Runtime Intelligence
 * - Reconciliation
 * - Reliability
 * - Incident Intelligence
 * - Change Intelligence
 */

import React, { useState, useMemo } from "react";
import {
  Activity, ArrowDownToLine, GitCompare, ShieldAlert, Zap, GitPullRequest,
  CheckCircle2, AlertTriangle, Layers, Play, Check
} from "lucide-react";
import type { ArchitectureModel } from "../../lab/model";
import { IngestionCenter } from "./IngestionCenter";
import { RuntimeIntel } from "./RuntimeIntel";
import { ReconciliationView } from "./ReconciliationView";
import { ReliabilityView } from "./ReliabilityView";
import { IncidentWorkspace } from "./IncidentWorkspace";
import { ChangeReview } from "./ChangeReview";
import {
  section8IntendedModel,
  section8ObservedSpans,
} from "../fixtures";
import { modelToIntendedGraph } from "../models";
import { InfrastructureConnector } from "../connectors/infra";
import { RuntimeTopologyBuilder } from "../topology";
import { ArchitectureReconciler, type ReconciliationRecord } from "../reconciliation";
import { DriftManager } from "../drift";
import { ReliabilityEngine } from "../reliability";
import { IncidentIntelligenceEngine, type IncidentRecord } from "../incidents";
import { OperationalHistoryStore } from "../history";
import { IngestionGovernance } from "../governance";

export type RealityTab =
  | "overview"
  | "ingestion"
  | "runtime"
  | "reconciliation"
  | "reliability"
  | "incidents"
  | "changes";

interface RealityEngineAppProps {
  model: ArchitectureModel;
  onNavigateAtlas: (section: any) => void;
  onAdoptModel?: (model: ArchitectureModel) => void;
}

const SAMPLE_INCIDENT: IncidentRecord = {
  id: "INC-2026-089",
  title: "Checkout Latency Spike & Undocumented Pricing Service Cascade",
  severity: "SEV-1",
  status: "investigating",
  startTimeIso: "2026-11-04T12:00:00.000Z",
  impactedServices: ["Client", "API Gateway", "Order Service", "Pricing Service", "Order Database"],
  timeline: [
    {
      id: "tl-1",
      timestampIso: "2026-11-04T12:05:00.000Z",
      source: "deployment",
      service: "Pricing Service",
      summary: "Release v1.4.0 deployed to production",
      severity: "info",
    },
    {
      id: "tl-2",
      timestampIso: "2026-11-04T12:10:00.000Z",
      source: "reconciliation",
      service: "Order Service",
      summary: "Undocumented call path to Pricing Service detected",
      severity: "critical",
    },
    {
      id: "tl-3",
      timestampIso: "2026-11-04T12:15:00.000Z",
      source: "metric",
      service: "Order Database",
      summary: "Connection pool utilization reached 98%",
      severity: "warning",
    },
    {
      id: "tl-4",
      timestampIso: "2026-11-04T12:20:00.000Z",
      source: "trace",
      service: "Order Service",
      summary: "p95 request latency spiked to 480ms (SLA 200ms)",
      severity: "critical",
    },
  ],
  hypotheses: [
    {
      id: "hypo-1",
      candidateCause: "Pricing Service v1.4.0 bypassed queue and saturated Order DB connections",
      suspectService: "Pricing Service",
      confidence: "SUPPORTED",
      confidenceScore: 0.88,
      supportingEvidence: [
        "Deployment event v1.4.0 at T-40m",
        "Undocumented direct call from Order Service to Pricing Service",
        "Postgres connection pool saturation at T-30m",
      ],
      contradictingEvidence: [],
      rationale: "Correlated deployment followed by database exhaustion on unarchitected path.",
      recommendedAction: "Roll back Pricing Service v1.4.0 or route calls asynchronously via Message Queue.",
    },
  ],
  notes: [
    "Order Service team confirmed adding direct call to Pricing Service in last release.",
    "Database team investigating unindexed pricing queries.",
  ],
};

export const RealityEngineApp: React.FC<RealityEngineAppProps> = ({
  model,
  onNavigateAtlas,
  onAdoptModel,
}) => {
  const [activeTab, setActiveTab] = useState<RealityTab>("overview");
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Core singleton state engines
  const historyStore = useMemo(() => new OperationalHistoryStore("ws-default"), []);
  const governance = useMemo(() => new IngestionGovernance(), []);
  const reconciler = useMemo(() => new ArchitectureReconciler(), []);
  const reliabilityEngine = useMemo(() => new ReliabilityEngine(), []);
  const incidentEngine = useMemo(() => new IncidentIntelligenceEngine(), []);

  // Active models & graphs
  const [workingModel, setWorkingModel] = useState<ArchitectureModel>(model);
  const [observedSpans, setObservedSpans] = useState(() => section8ObservedSpans());

  // Derive graphs
  const intendedGraph = useMemo(() => modelToIntendedGraph(workingModel), [workingModel]);
  const configuredGraph = useMemo(() => {
    const connector = new InfrastructureConnector();
    return connector.toConfiguredGraph([
      { id: "cfg-api-gateway", name: "API Gateway", kind: "service", ports: [8080], environmentVariables: {}, dependencies: [{ targetName: "Order Service", relationship: "CALL" }], labels: {} },
      { id: "cfg-order-svc", name: "Order Service", kind: "service", ports: [8081], environmentVariables: {}, dependencies: [{ targetName: "Message Queue", relationship: "CALL" }], labels: {} },
      { id: "cfg-queue", name: "Message Queue", kind: "queue", ports: [5672], environmentVariables: {}, dependencies: [{ targetName: "Order Worker", relationship: "EVENT" }], labels: {} },
      { id: "cfg-worker", name: "Order Worker", kind: "service", ports: [], environmentVariables: {}, dependencies: [{ targetName: "Order Database", relationship: "WRITE" }], labels: {} },
      { id: "cfg-database", name: "Order Database", kind: "database", ports: [5432], environmentVariables: {}, dependencies: [], labels: {} },
    ]);
  }, []);

  const observedGraph = useMemo(() => {
    const builder = new RuntimeTopologyBuilder();
    return builder.buildFromSpans(observedSpans);
  }, [observedSpans]);

  // Reconciliation output
  const { records: initialRecords } = useMemo(
    () => reconciler.reconcile(intendedGraph, configuredGraph, observedGraph),
    [reconciler, intendedGraph, configuredGraph, observedGraph]
  );

  const [driftRecords, setDriftRecords] = useState<ReconciliationRecord[]>(initialRecords);
  const driftManager = useMemo(() => new DriftManager(driftRecords), [driftRecords]);

  // Load Section 8 Mandatory Demo
  const loadSection8Demo = () => {
    const s8Model = section8IntendedModel();
    setWorkingModel(s8Model);
    setObservedSpans(section8ObservedSpans());
    setDemoLoaded(true);

    const { records } = reconciler.reconcile(
      modelToIntendedGraph(s8Model),
      configuredGraph,
      new RuntimeTopologyBuilder().buildFromSpans(section8ObservedSpans())
    );
    setDriftRecords(records);
    setNotification("Loaded Section 8 Mandatory Fixture: Intended vs Observed Order Flow");
    setTimeout(() => setNotification(null), 4000);
  };

  const sampleIncident = SAMPLE_INCIDENT;

  const handleTriageAction = (recordId: string, action: any, rationale: string) => {
    const updated = driftManager.applyAction({
      recordId,
      action,
      actor: "Lead Engineer",
      rationale,
    });
    setDriftRecords((prev) => prev.map((r) => (r.id === recordId ? updated : r)));

    if (action === "accept_as_intended" && onAdoptModel) {
      // Add missing Pricing Service component & edge to architecture
      const updatedComponents = [...workingModel.components];
      const updatedConnections = [...workingModel.connections];

      if (!updatedComponents.some((c) => c.id === "comp-pricing-svc")) {
        updatedComponents.push({
          id: "comp-pricing-svc",
          name: "Pricing Service",
          kind: "service",
          zoneId: "zone-internal",
          config: { criticality: 4 },
          requirementIds: [],
        });
      }
      if (!updatedConnections.some((c) => c.from === "comp-order-svc" && c.to === "comp-pricing-svc")) {
        updatedConnections.push({
          id: `conn-pricing-${Date.now()}`,
          from: "comp-order-svc",
          to: "comp-pricing-svc",
          kind: "sync",
          criticality: 4,
          failureBehavior: "blocks",
          operationIds: [],
          requirementIds: [],
        });
      }

      const newModel: ArchitectureModel = {
        ...workingModel,
        components: updatedComponents,
        connections: updatedConnections,
      };
      setWorkingModel(newModel);
      onAdoptModel(newModel);
      setNotification('Updated canonical architecture: Added "Pricing Service" as intended dependency.');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner & Section 8 Fixture Trigger */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/90 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-sky-300 uppercase tracking-wider">DATANOVA REALITY ENGINE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Architecture-to-Runtime Reconciliation</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSection8Demo}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              demoLoaded
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
            }`}
          >
            {demoLoaded ? <Check size={13} /> : <Play size={13} />}
            {demoLoaded ? "Section 8 Fixture Loaded" : "Load Section 8 Demo"}
          </button>
          <button
            onClick={() => onNavigateAtlas("studio")}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
          >
            <Layers size={13} />
            <span>Open in 3D Studio</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="px-4 py-1.5 bg-sky-500/20 border-b border-sky-500/40 text-sky-200 text-xs flex items-center gap-2">
          <CheckCircle2 size={13} className="text-sky-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Sub-Navigation Rail */}
      <div className="flex items-center gap-1 px-4 border-b border-slate-800 bg-slate-900/50 overflow-x-auto text-xs shrink-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "overview"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity size={14} />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("ingestion")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "ingestion"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowDownToLine size={14} />
          <span>Ingestion Center</span>
        </button>
        <button
          onClick={() => setActiveTab("runtime")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "runtime"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers size={14} />
          <span>Runtime Intelligence</span>
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "reconciliation"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GitCompare size={14} />
          <span>Reconciliation</span>
          {driftRecords.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {driftRecords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("reliability")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "reliability"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Zap size={14} />
          <span>Reliability & SLOs</span>
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "incidents"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Incident Intelligence</span>
        </button>
        <button
          onClick={() => setActiveTab("changes")}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "changes"
              ? "border-sky-400 text-sky-300 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GitPullRequest size={14} />
          <span>Change Impact & Release</span>
        </button>
      </div>

      {/* Main Viewport Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-0">
        {activeTab === "overview" && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Hero */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">
                    DataNova Reality Engine
                  </h1>
                  <p className="text-sm text-slate-400 mt-1 max-w-3xl">
                    Reconstructs operational reality from distributed traces, Prometheus metrics, structured logs, and infrastructure manifests, reconciling them against canonical architecture intent without collapsing sovereign views.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 font-mono text-xs">
                  4 SOVEREIGN VIEWS MAINTAINED
                </div>
              </div>

              {/* 4 Sovereign Views Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-sky-400">1. Intended</span>
                    <span className="font-mono text-[11px]">v{workingModel.schemaVersion}</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-2">
                    {intendedGraph.nodes.length} Components
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {intendedGraph.edges.length} declared connections in architecture model.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-purple-400">2. Configured</span>
                    <span className="font-mono text-[11px]">K8s Manifests</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-2">
                    {configuredGraph.nodes.length} Resources
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Declared Deployments, Services, and StatefulSets.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-emerald-400">3. Observed</span>
                    <span className="font-mono text-[11px]">{observedSpans.length} Spans</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-2">
                    {observedGraph.nodes.length} Active Services
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {observedGraph.edges.length} interacting service-to-service call paths.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-rose-400">4. Derived Drift</span>
                    <span className="font-mono text-[11px]">{driftRecords.length} Findings</span>
                  </div>
                  <div className="text-lg font-bold text-rose-300 mt-2">
                    {driftRecords.filter((r) => r.severity === "critical").length} Critical Drift
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Undocumented dependencies & unobserved intent.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setActiveTab("reconciliation")}
                className="cursor-pointer group rounded-xl border border-slate-800 hover:border-sky-500/50 bg-slate-900/40 p-5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                  Investigate Architecture Drift
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Examine {driftRecords.length} reconciliation finding(s) including undocumented dependencies.
                </p>
              </div>

              <div
                onClick={() => setActiveTab("runtime")}
                className="cursor-pointer group rounded-xl border border-slate-800 hover:border-sky-500/50 bg-slate-900/40 p-5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3">
                  <Layers size={18} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                  Explore Distributed Traces
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect parent-child span waterfalls and jump directly to spatial architecture nodes.
                </p>
              </div>

              <div
                onClick={() => setActiveTab("incidents")}
                className="cursor-pointer group rounded-xl border border-slate-800 hover:border-sky-500/50 bg-slate-900/40 p-5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                  <ShieldAlert size={18} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                  Incident Intelligence
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Correlate multi-signal timelines, test causal hypotheses, and generate postmortems.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ingestion" && (
          <IngestionCenter
            historyStore={historyStore}
            governance={governance}
            onImportComplete={(envelopes) => {
              setObservedSpans(
                envelopes
                  .filter((e) => e.sourceType === "trace")
                  .map((e) => ({
                    traceId: e.traceId || "tr-import",
                    spanId: e.spanId || "sp-import",
                    parentSpanId: e.parentSpanId,
                    serviceName: e.serviceIdentity || "imported-svc",
                    name: e.sourceResourceId || "op",
                    durationMs: Number(e.measurementValue || 10),
                    statusCode: "OK",
                    startTimeIso: e.observedTime,
                    endTimeIso: e.observedTime,
                    kind: "SERVER",
                    attributes: {},
                  }))
              );
              setNotification(`Successfully ingested ${envelopes.length} evidence envelopes.`);
              setTimeout(() => setNotification(null), 4000);
            }}
          />
        )}

        {activeTab === "runtime" && (
          <RuntimeIntel
            observedGraph={observedGraph}
            spans={observedSpans}
            onSelectService={(_svc) => {
              onNavigateAtlas("studio");
            }}
          />
        )}

        {activeTab === "reconciliation" && (
          <ReconciliationView
            driftRecords={driftRecords}
            onTriageAction={handleTriageAction}
            onOpenInStudio={() => onNavigateAtlas("studio")}
          />
        )}

        {activeTab === "reliability" && (
          <ReliabilityView
            spans={observedSpans}
            driftCount={driftRecords.length}
            reliabilityEngine={reliabilityEngine}
          />
        )}

        {activeTab === "incidents" && (
          <IncidentWorkspace
            incident={sampleIncident}
            intended={intendedGraph}
            observed={observedGraph}
            driftRecords={driftRecords}
            incidentEngine={incidentEngine}
          />
        )}

        {activeTab === "changes" && (
          <ChangeReview
            driftCount={driftRecords.length}
          />
        )}
      </div>
    </div>
  );
};
