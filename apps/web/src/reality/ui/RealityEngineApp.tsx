/**
 * Campaign 07 — Flagship Product: DataNova Reality Engine UI
 *
 * Workspace shell featuring nested navigation across:
 * - Overview (Cockpit, 4 Sovereign Views, Interactive Architecture Flow Map)
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
  CheckCircle2, AlertTriangle, Layers, Play, Check, Server,
  Database, Network, ExternalLink, Cpu
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  const isPricingAdopted = workingModel.components.some((c) => c.id === "comp-pricing-svc");

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Cockpit Header Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur text-xs shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-black text-sky-300 tracking-wider text-xs">
              DATANOVA REALITY ENGINE
            </span>
          </div>
          <span className="text-slate-600 font-mono">/</span>
          <span className="text-slate-400 hidden sm:inline">
            Architecture-to-Runtime Reconciliation
          </span>
          <div className="hidden lg:flex items-center gap-2 pl-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/30">
              CLUSTER: PROD-US-EAST
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              LIVE TELEMETRY: 120 SPANS/S
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSection8Demo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              demoLoaded
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-500/20 shadow-md"
            }`}
          >
            {demoLoaded ? <Check size={14} className="text-emerald-400" /> : <Play size={14} />}
            <span>{demoLoaded ? "Section 8 Fixture Loaded" : "Load Section 8 Demo"}</span>
          </button>

          <button
            onClick={() => onNavigateAtlas("studio")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <Layers size={14} className="text-sky-400" />
            <span>Open in 3D Studio</span>
          </button>
        </div>
      </header>

      {/* Global Notification Banner */}
      {notification && (
        <div className="px-5 py-2 bg-sky-950/80 border-b border-sky-500/40 text-sky-200 text-xs flex items-center justify-between animate-fade-in shrink-0 z-10">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-sky-400 shrink-0" />
            <span className="font-medium">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs Rail */}
      <nav
        aria-label="Reality engine sections"
        className="flex items-center gap-1 px-5 border-b border-slate-800/80 bg-slate-900/60 overflow-x-auto text-xs shrink-0 backdrop-blur"
      >
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "overview"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Activity size={14} className={activeTab === "overview" ? "text-sky-400" : "text-slate-400"} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("ingestion")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "ingestion"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <ArrowDownToLine size={14} className={activeTab === "ingestion" ? "text-sky-400" : "text-slate-400"} />
          <span>Ingestion Center</span>
        </button>

        <button
          onClick={() => setActiveTab("runtime")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "runtime"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Layers size={14} className={activeTab === "runtime" ? "text-sky-400" : "text-slate-400"} />
          <span>Runtime Intelligence</span>
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "reconciliation"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <GitCompare size={14} className={activeTab === "reconciliation" ? "text-sky-400" : "text-slate-400"} />
          <span>Reconciliation</span>
          {driftRecords.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {driftRecords.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("reliability")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "reliability"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Zap size={14} className={activeTab === "reliability" ? "text-sky-400" : "text-slate-400"} />
          <span>Reliability & SLOs</span>
        </button>

        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "incidents"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <ShieldAlert size={14} className={activeTab === "incidents" ? "text-sky-400" : "text-slate-400"} />
          <span>Incident Intelligence</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            1 Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab("changes")}
          className={`flex items-center gap-2 px-3.5 py-3 border-b-2 font-medium transition-all ${
            activeTab === "changes"
              ? "border-sky-400 text-sky-200 font-bold bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <GitPullRequest size={14} className={activeTab === "changes" ? "text-sky-400" : "text-slate-400"} />
          <span>Change Impact & Release</span>
        </button>
      </nav>

      {/* Main Viewport Workspace Content */}
      <main className="flex-1 overflow-y-auto p-5 lg:p-7 min-h-0 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950">
        {activeTab === "overview" && (
          <div className="max-w-6xl mx-auto space-y-7">
            {/* Header Hero Banner */}
            <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      FLAGSHIP ARCHITECTURE ENGINE
                    </span>
                    <span className="text-slate-500 text-xs">&bull;</span>
                    <span className="text-xs text-slate-400 font-mono">CANONICAL IR SYNCHRONIZED</span>
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    DataNova Reality Engine
                  </h1>
                  <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    Reconstructs operational reality from distributed traces, Prometheus metrics, structured logs, and infrastructure manifests, reconciling them against canonical architecture intent without collapsing sovereign views.
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className="px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 font-mono text-xs font-bold tracking-wide">
                    4 SOVEREIGN VIEWS MAINTAINED
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Zero-leakage telemetry boundary active
                  </span>
                </div>
              </div>

              {/* 4 Sovereign Views Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 relative z-10">
                {/* 1. Intended */}
                <div className="rounded-xl border border-sky-500/30 bg-slate-950/80 p-4 transition-all hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/5 group">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-sky-400 flex items-center gap-1.5">
                      <Network size={14} />
                      <span>1. Intended</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">
                      v{workingModel.schemaVersion}
                    </span>
                  </div>
                  <div className="text-xl font-black text-white mt-2.5">
                    {intendedGraph.nodes.length} Components
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    {intendedGraph.edges.length} declared connections in architecture model.
                  </p>
                </div>

                {/* 2. Configured */}
                <div className="rounded-xl border border-purple-500/30 bg-slate-950/80 p-4 transition-all hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/5 group">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-purple-400 flex items-center gap-1.5">
                      <Server size={14} />
                      <span>2. Configured</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                      K8s Manifests
                    </span>
                  </div>
                  <div className="text-xl font-black text-white mt-2.5">
                    {configuredGraph.nodes.length} Resources
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Declared Deployments, Services, and StatefulSets.
                  </p>
                </div>

                {/* 3. Observed */}
                <div className="rounded-xl border border-emerald-500/30 bg-slate-950/80 p-4 transition-all hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/5 group">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Activity size={14} />
                      <span>3. Observed</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                      {observedSpans.length} Spans
                    </span>
                  </div>
                  <div className="text-xl font-black text-white mt-2.5">
                    {observedGraph.nodes.length} Active Services
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    {observedGraph.edges.length} interacting service-to-service call paths.
                  </p>
                </div>

                {/* 4. Derived Drift */}
                <div className="rounded-xl border border-rose-500/30 bg-slate-950/80 p-4 transition-all hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-500/5 group">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      <span>4. Derived</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                      {driftRecords.length} Findings
                    </span>
                  </div>
                  <div className="text-xl font-black text-rose-300 mt-2.5">
                    {driftRecords.filter((r) => r.severity === "critical").length} Critical Drift
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Undocumented dependencies & unobserved intent.
                  </p>
                </div>
              </div>
            </div>

            {/* Architecture Flow & Live Drift Visualizer */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu size={16} className="text-sky-400" />
                    <span>Reconciled Service Topology & Divergence Map</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visual comparison of declared architecture intent versus observed runtime execution paths.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <span className="w-2.5 h-1 bg-sky-400 rounded" /> Intended Path
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
                    <span className="w-2.5 h-1 bg-rose-400 rounded" /> Undocumented Call
                  </span>
                </div>
              </div>

              {/* Visual Interactive Diagram Card */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/90 relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center text-center">
                  {/* Step 1: Client */}
                  <div
                    onMouseEnter={() => setHoveredNode("Client")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-3.5 rounded-xl border border-slate-700 bg-slate-900/80 transition-all hover:border-sky-400 hover:scale-105 cursor-pointer"
                  >
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Tier 1 · Internet</div>
                    <div className="font-bold text-white mt-1 text-xs">Client</div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-1">HTTP 200 OK</div>
                  </div>

                  {/* Step 2: API Gateway */}
                  <div
                    onMouseEnter={() => setHoveredNode("API Gateway")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-3.5 rounded-xl border border-slate-700 bg-slate-900/80 transition-all hover:border-sky-400 hover:scale-105 cursor-pointer"
                  >
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Tier 2 · DMZ</div>
                    <div className="font-bold text-white mt-1 text-xs">API Gateway</div>
                    <div className="text-[10px] text-sky-300 font-mono mt-1">160ms Duration</div>
                  </div>

                  {/* Step 3: Order Service (Fork Point) */}
                  <div
                    onMouseEnter={() => setHoveredNode("Order Service")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-3.5 rounded-xl border border-amber-500/50 bg-amber-950/20 transition-all hover:border-amber-400 hover:scale-105 cursor-pointer shadow-sm"
                  >
                    <div className="text-[10px] font-mono text-amber-300 uppercase">Tier 3 · Microservice</div>
                    <div className="font-bold text-white mt-1 text-xs">Order Service</div>
                    <div className="text-[10px] text-amber-300 font-mono mt-1">Forking Traffic</div>
                  </div>

                  {/* Step 4: Asynchronous Queue vs Undocumented Call */}
                  <div className="space-y-3">
                    {/* Intended Queue */}
                    <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-[11px] text-slate-400">
                      <div className="text-[9px] font-mono text-slate-500 uppercase">Intended Async Queue</div>
                      <div className="font-medium text-slate-300">Message Queue</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">0 Observed Traffic</div>
                    </div>

                    {/* Observed Divergence */}
                    <div className="p-2.5 rounded-lg border border-rose-500/50 bg-rose-950/30 text-[11px] animate-pulse">
                      <div className="text-[9px] font-mono text-rose-300 uppercase font-bold">Undocumented Call</div>
                      <div className="font-bold text-rose-200">Pricing Service</div>
                      <div className="text-[10px] text-rose-300 font-mono mt-0.5">
                        {isPricingAdopted ? "✓ Adopted in v2" : "Direct Sync Query"}
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Database */}
                  <div
                    onMouseEnter={() => setHoveredNode("Order Database")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-3.5 rounded-xl border border-slate-700 bg-slate-900/80 transition-all hover:border-sky-400 hover:scale-105 cursor-pointer"
                  >
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Persistence</div>
                    <div className="font-bold text-white mt-1 text-xs flex items-center justify-center gap-1">
                      <Database size={13} className="text-sky-400" />
                      <span>Order Database</span>
                    </div>
                    <div className="text-[10px] text-rose-400 font-mono mt-1">98% Pool Saturation</div>
                  </div>
                </div>

                {hoveredNode && (
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Inspecting: <strong className="text-white">{hoveredNode}</strong>
                    </span>
                    <button
                      onClick={() => setActiveTab("reconciliation")}
                      className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                    >
                      <span>View Reconciliation Details</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Exploration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div
                onClick={() => setActiveTab("reconciliation")}
                className="cursor-pointer group rounded-2xl border border-slate-800 hover:border-rose-500/50 bg-gradient-to-b from-slate-900/60 to-slate-950 p-5 transition-all hover:shadow-xl hover:shadow-rose-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                  Investigate Architecture Drift
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Examine {driftRecords.length} reconciliation finding(s) including undocumented dependencies and unobserved components.
                </p>
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mt-3">
                  <span>Open Triage Desk</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("runtime")}
                className="cursor-pointer group rounded-2xl border border-slate-800 hover:border-sky-500/50 bg-gradient-to-b from-slate-900/60 to-slate-950 p-5 transition-all hover:shadow-xl hover:shadow-sky-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                  <Layers size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                  Explore Distributed Traces
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Inspect parent-child span waterfalls and jump directly to spatial architecture nodes in the 3D studio.
                </p>
                <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold mt-3">
                  <span>Open Trace Explorer</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("incidents")}
                className="cursor-pointer group rounded-2xl border border-slate-800 hover:border-amber-500/50 bg-gradient-to-b from-slate-900/60 to-slate-950 p-5 transition-all hover:shadow-xl hover:shadow-amber-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  Incident Intelligence
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Correlate multi-signal timelines, test causal hypotheses with zero false certainty, and generate postmortems.
                </p>
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mt-3">
                  <span>Open Incident Command</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
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
          <ChangeReview driftCount={driftRecords.length} />
        )}
      </main>
    </div>
  );
};
