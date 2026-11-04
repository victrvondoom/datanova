/**
 * Campaign 07 — Task 06 & Ingestion Center UI
 *
 * Connector management, safe payload import, quarantine review,
 * and data quality reporting.
 */

import React, { useState } from "react";
import {
  UploadCloud, AlertOctagon, CheckCircle2, ShieldCheck,
  Activity, RefreshCw
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Ingestion Center</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Ingest OpenTelemetry traces, Prometheus metrics, structured logs, and infrastructure manifests with strict read-only guarantees.
        </p>
      </div>

      {/* Connectors Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {connectors.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedConnector(c.id)}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              selectedConnector === c.id
                ? "border-sky-500 bg-sky-500/10 shadow-sm"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="truncate">{c.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                v{c.version}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Formats: {c.supportedFormats.join(", ")}
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck size={13} />
              <span>Read-Only Boundary</span>
            </div>
          </div>
        ))}
      </div>

      {/* Ingestion Console */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud size={16} className="text-sky-400" />
            <h3 className="text-sm font-bold text-white">Import Payload</h3>
          </div>
          <button
            onClick={handleLoadSample}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
          >
            Load Sample Payload
          </button>
        </div>

        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          placeholder={`Paste ${selectedConnector} JSON or YAML content here...`}
          rows={7}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500"
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {payloadText ? `${payloadText.length} characters ready to parse` : "Awaiting input payload"}
          </div>
          <button
            onClick={handleRunImport}
            disabled={!payloadText.trim() || isImporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            {isImporting ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
            <span>{isImporting ? "Parsing..." : "Ingest & Normalize"}</span>
          </button>
        </div>

        {importStatus && (
          <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={14} className="text-sky-400" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* Quality Report & Quarantine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quality Report */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Data Quality & Freshness</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              {qualityReport.coveragePercentage}% Coverage
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="text-lg font-bold text-white">{qualityReport.totalEnvelopes}</div>
              <div className="text-[10px] text-slate-500 uppercase mt-0.5">Envelopes</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="text-lg font-bold text-amber-400">{qualityReport.staleCount}</div>
              <div className="text-[10px] text-slate-500 uppercase mt-0.5">Stale (&gt;24h)</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="text-lg font-bold text-rose-400">{qualityReport.quarantinedCount}</div>
              <div className="text-[10px] text-slate-500 uppercase mt-0.5">Quarantined</div>
            </div>
          </div>

          {qualityReport.recommendations.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-semibold text-slate-300">Recommendations:</span>
              {qualityReport.recommendations.map((rec, i) => (
                <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-amber-400">&bull;</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Quarantine */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon size={16} className="text-rose-400" />
              <h3 className="text-sm font-bold text-white">Evidence Quarantine</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {quarantined.length} Quarantined
            </span>
          </div>

          {quarantined.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No quarantined inputs. All ingested telemetry passed validation and schema integrity checks.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
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
