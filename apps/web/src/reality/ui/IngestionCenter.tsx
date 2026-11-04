/**
 * Campaign 07 — Task 06 & Ingestion Center UI
 *
 * High-Density Telemetry Ingestion Console:
 * Connector management, safe payload import, quarantine review,
 * and data quality reporting with strict read-only guarantees.
 */

import React, { useState } from "react";
import {
  UploadCloud, AlertOctagon, CheckCircle2, ShieldCheck,
  Activity, RefreshCw, Radio, BarChart3, FileCode, Boxes,
  Terminal, Lock, Sparkles, Database
} from "lucide-react";
import { ConnectorRegistry } from "../connectors/registry";
import { OTelTraceConnector } from "../connectors/otel";
import { PrometheusConnector } from "../connectors/metrics";
import { StructuredLogConnector } from "../connectors/logs";
import { InfrastructureConnector } from "../connectors/infra";
import type { OperationalHistoryStore } from "../history";
import type { IngestionGovernance } from "../governance";
import type { OperationalEvidenceEnvelope } from "../envelope";
import { section8ObservedSpans, section8ConfiguredYaml } from "../fixtures";

interface IngestionCenterProps {
  historyStore: OperationalHistoryStore;
  governance: IngestionGovernance;
  onImportComplete: (envelopes: OperationalEvidenceEnvelope[]) => void;
}

export const IngestionCenter: React.FC<IngestionCenterProps> = ({
  historyStore,
  governance,
  onImportComplete,
}) => {
  const [selectedConnector, setSelectedConnector] = useState("opentelemetry-traces");
  const [payloadText, setPayloadText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const registry = React.useMemo(() => {
    const reg = new ConnectorRegistry();
    reg.register(new OTelTraceConnector());
    reg.register(new PrometheusConnector());
    reg.register(new StructuredLogConnector());
    reg.register(new InfrastructureConnector());
    return reg;
  }, []);

  const connectors = registry.list();
  const qualityReport = governance.evaluateQuality(historyStore.getEnvelopes(), 6);
  const quarantined = governance.getQuarantinedItems();

  const handleRunImport = async () => {
    if (!payloadText.trim()) return;
    setIsImporting(true);

    try {
      const result = await registry.runIngestion(selectedConnector, payloadText, {
        workspaceId: "ws-default",
        environment: "production",
      });

      for (const env of result.envelopes) {
        historyStore.appendEnvelope(env);
      }

      onImportComplete(result.envelopes);
      setImportStatus(`Ingested ${result.itemsIngested} items successfully (${result.errors.length} errors).`);
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: unknown) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadSample = () => {
    if (selectedConnector === "opentelemetry-traces") {
      setPayloadText(JSON.stringify(section8ObservedSpans(), null, 2));
    } else if (selectedConnector === "infrastructure-manifests") {
      setPayloadText(section8ConfiguredYaml());
    } else if (selectedConnector === "prometheus-metrics") {
      setPayloadText(`http_requests_total{service="Order Service",status="200"} 4120\nhttp_requests_total{service="Pricing Service",status="200"} 2900\nprocess_cpu_seconds_total{service="Order Service"} 14.8`);
    } else {
      setPayloadText(`{"timestamp":"${new Date().toISOString()}","level":"INFO","service":"Order Service","message":"Direct pricing query dispatched","traceId":"tr-001"}`);
    }
  };

  const getConnectorIcon = (id: string) => {
    switch (id) {
      case "opentelemetry-traces":
        return <Radio size={16} className="text-sky-400" />;
      case "prometheus-metrics":
        return <BarChart3 size={16} className="text-amber-400" />;
      case "structured-logs":
        return <FileCode size={16} className="text-emerald-400" />;
      case "infrastructure-manifests":
        return <Boxes size={16} className="text-purple-400" />;
      default:
        return <Database size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Ingestion Center</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
              TELEMETRY BUS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Ingest OpenTelemetry traces, Prometheus metrics, structured logs, and infrastructure manifests with strict read-only guarantees.
          </p>
        </div>

        {/* HUD Quick Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <Lock size={12} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">PII Filter</div>
              <div className="text-[11px] font-mono text-emerald-300 font-semibold">Active & Sanitized</div>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <ShieldCheck size={12} className="text-sky-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Integrity</div>
              <div className="text-[11px] font-mono text-sky-300 font-semibold">SHA-256 Attested</div>
            </div>
          </div>
        </div>
      </div>

      {/* Connectors Overview Grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase font-mono">
            Registered Telemetry Connectors ({connectors.length})
          </span>
          <span className="text-[11px] text-slate-500">Select connector to ingest or view schema</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {connectors.map((c) => {
            const isSelected = selectedConnector === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedConnector(c.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 relative overflow-hidden group ${
                  isSelected
                    ? "border-sky-500/80 bg-gradient-to-b from-sky-500/15 to-slate-900/80 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/40"
                    : "border-slate-800/80 bg-slate-900/50 hover:border-slate-700/80 hover:bg-slate-900/80"
                }`}
              >
                {/* Accent top stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-0.5 transition-opacity ${
                    isSelected ? "bg-gradient-to-r from-sky-400 to-blue-500 opacity-100" : "opacity-0 group-hover:opacity-40 bg-slate-600"
                  }`}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      {getConnectorIcon(c.id)}
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-sky-200 transition-colors">
                      {c.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-bold">
                    v{c.version}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Formats:</span>
                    <span className="font-mono text-slate-300 text-[10px]">{c.supportedFormats.join(", ")}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Protocol:</span>
                    <span className="font-mono text-slate-300 text-[10px]">
                      {c.id.includes("trace") ? "OTLP/gRPC" : c.id.includes("prom") ? "Pull / Text" : c.id.includes("infra") ? "K8s / Terraform" : "NDJSON"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <ShieldCheck size={13} />
                    <span>Read-Only Boundary</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>READY</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ingestion Console / Payload Studio */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
        {/* Terminal Header */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-sky-400" />
              <span className="text-xs font-mono font-bold text-white tracking-wide">
                TELEMETRY_INGESTION_BUFFER :: {selectedConnector.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="px-2.5 py-1 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles size={12} className="text-sky-400" />
              <span>Load Sample Payload</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500 px-2 py-1 rounded bg-slate-900 border border-slate-800">
              NON-MUTATING
            </span>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="p-5 space-y-4">
          <div className="relative rounded-lg border border-slate-800 bg-slate-950 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/80 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                Raw Payload Input Buffer
              </span>
              <span>{payloadText ? `${payloadText.length} characters` : "Empty buffer"}</span>
            </div>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              placeholder={`Paste ${selectedConnector} JSON, YAML, or OpenMetrics formatted content here...`}
              rows={8}
              className="w-full bg-transparent p-3.5 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{payloadText ? `${payloadText.split("\n").length} lines ready for cryptographic normalization` : "Awaiting input telemetry payload"}</span>
            </div>

            <button
              onClick={handleRunImport}
              disabled={!payloadText.trim() || isImporting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 active:scale-[0.98]"
            >
              {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              <span>{isImporting ? "Parsing & Attesting..." : "Ingest & Normalize"}</span>
            </button>
          </div>

          {importStatus && (
            <div className="p-3.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-200 text-xs flex items-center gap-2.5 shadow-sm animate-fadeIn">
              <CheckCircle2 size={16} className="text-sky-400 shrink-0" />
              <span className="font-medium">{importStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quality Report & Quarantine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quality Report */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                <Activity size={15} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Data Quality & Freshness</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Signal Health:</span>
              <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                {qualityReport.coveragePercentage}% Coverage
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90">
              <div className="text-xl font-bold font-mono text-white">{qualityReport.totalEnvelopes}</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5 font-bold">Envelopes</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90">
              <div className="text-xl font-bold font-mono text-amber-400">{qualityReport.staleCount}</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5 font-bold">Stale (&gt;24h)</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90">
              <div className="text-xl font-bold font-mono text-rose-400">{qualityReport.quarantinedCount}</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5 font-bold">Quarantined</div>
            </div>
          </div>

          {qualityReport.recommendations.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <span className="text-xs font-semibold text-slate-300 font-mono text-[11px] uppercase tracking-wider block">
                Quality Recommendations:
              </span>
              <div className="space-y-1.5">
                {qualityReport.recommendations.map((rec, i) => (
                  <div key={i} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-amber-400 font-bold">&bull;</span>
                    <span className="leading-snug">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Evidence Quarantine */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-rose-500/10 border border-rose-500/30">
                <AlertOctagon size={15} className="text-rose-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Evidence Quarantine</h3>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {quarantined.length} Quarantined
            </span>
          </div>

          {quarantined.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center justify-center gap-2">
              <ShieldCheck size={28} className="text-emerald-400/60" />
              <div className="font-semibold text-slate-300">Quarantine Vault Clear</div>
              <p className="text-[11px] text-slate-500 max-w-xs">
                No quarantined inputs. All ingested telemetry passed validation and schema integrity checks.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {quarantined.map((q) => (
                <div key={q.id} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs">
                  <div className="flex items-center justify-between font-semibold text-rose-300">
                    <span>{q.sourceSystem} ({q.sourceType})</span>
                    <span className="text-[10px] text-slate-400 font-mono">{q.quarantinedAt.slice(11, 19)}</span>
                  </div>
                  <div className="text-rose-200 mt-1">{q.reasons.join("; ")}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                    Payload: {q.rawPayloadSummary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
