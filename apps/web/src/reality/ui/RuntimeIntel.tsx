/**
 * Campaign 07 — Task 12 & 19: Runtime Intelligence & Trace Explorer
 *
 * High-Density Runtime Observability Console:
 * Live service topology table, interactive trace waterfall, span inspector,
 * and direct spatial linking to architecture nodes.
 */

import React, { useState } from "react";
import {
  Layers, Search, Clock, ArrowRight, AlertCircle, CheckCircle, ExternalLink,
  CornerDownRight, Copy, Check
} from "lucide-react";
import type { ObservedGraph } from "../models";
import type { NormalizedSpan } from "../connectors/otel";

interface RuntimeIntelProps {
  observedGraph: ObservedGraph;
  spans: NormalizedSpan[];
  onSelectService: (serviceName: string) => void;
}

export const RuntimeIntel: React.FC<RuntimeIntelProps> = ({
  observedGraph,
  spans,
  onSelectService,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpanId, setSelectedSpanId] = useState<string>(spans[0]?.spanId || "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSpans = spans.filter(
    (s) =>
      s.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.traceId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSpan = spans.find((s) => s.spanId === selectedSpanId) || spans[0];
  const maxDuration = Math.max(1, ...spans.map((s) => s.durationMs));

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top HUD Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Runtime Intelligence & Trace Explorer</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Inspect reconstructed service interactions, trace waterfalls, and timing breakdowns derived from actual telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <Clock size={12} className="text-sky-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Telemetry Window</div>
              <div className="text-[11px] font-mono text-sky-300 font-semibold">
                {observedGraph.windowStart.slice(11, 19)} &rarr; {observedGraph.windowEnd.slice(11, 19)} UTC
              </div>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <Layers size={12} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Topology Density</div>
              <div className="text-[11px] font-mono text-emerald-300 font-semibold">
                {observedGraph.nodes.length} Nodes &bull; {observedGraph.edges.length} Edges
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Observed Service Topology Table */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
              <Layers size={16} className="text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Active Runtime Services ({observedGraph.nodes.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {observedGraph.edges.length} Communicating Edges
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Service Name</th>
                <th className="py-2.5 px-3">Kind</th>
                <th className="py-2.5 px-3">Call Volume</th>
                <th className="py-2.5 px-3">p95 Latency</th>
                <th className="py-2.5 px-3">Error Spans</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {observedGraph.nodes.map((node) => {
                const incomingEdges = observedGraph.edges.filter((e) => e.targetId === node.id);
                const totalCalls = incomingEdges.reduce((sum, e) => sum + (e.callCount || 0), 0) || 1;
                const totalErrors = incomingEdges.reduce((sum, e) => sum + (e.errorCount || 0), 0);
                const avgP95 = incomingEdges[0]?.p95LatencyMs || 25;

                return (
                  <tr key={node.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3 px-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${totalErrors > 0 ? "bg-rose-400 animate-pulse" : avgP95 > 100 ? "bg-amber-400" : "bg-emerald-400"}`} />
                        <span className="group-hover:text-sky-300 transition-colors font-bold">{node.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-300">
                        {node.kind}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-sky-400 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.round((totalCalls / 4500) * 100))}%` }}
                          />
                        </div>
                        <span className="text-slate-300">{totalCalls.toLocaleString()} calls</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          avgP95 > 150
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : avgP95 > 50
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {avgP95} ms
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {totalErrors > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px]">
                          {totalErrors} errors
                        </span>
                      ) : (
                        <span className="text-emerald-400/90 font-medium">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onSelectService(node.name)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-[11px] font-semibold text-sky-300 transition-colors shadow-sm"
                      >
                        <span>Inspect in 3D</span>
                        <ExternalLink size={12} className="text-sky-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trace Explorer & Waterfall */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trace Span Waterfall List */}
        <div className="md:col-span-2 rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
                <Clock size={16} className="text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Trace Waterfall ({filteredSpans.length} Spans)
              </h3>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter service, operation, trace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-slate-700/80 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Timing guideline ruler */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1 border-b border-slate-800/40 pb-1">
            <span>0 ms</span>
            <span>{Math.round(maxDuration / 2)} ms</span>
            <span>{maxDuration} ms (max)</span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredSpans.map((span) => {
              const widthPct = Math.max(8, Math.round((span.durationMs / maxDuration) * 100));
              const isSelected = span.spanId === selectedSpan?.spanId;
              const isChild = !!span.parentSpanId;

              return (
                <div
                  key={span.spanId}
                  onClick={() => setSelectedSpanId(span.spanId)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all duration-150 ${
                    isSelected
                      ? "border-sky-500 bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-slate-950/80 shadow-md ring-1 ring-sky-500/30"
                      : "border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950/90"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      {isChild && (
                        <div className="flex items-center text-slate-500 ml-1 shrink-0">
                          <CornerDownRight size={13} />
                        </div>
                      )}
                      <span className="font-bold text-white tracking-wide truncate">{span.serviceName}</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate">&bull; {span.name}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          span.durationMs > 100
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {span.durationMs} ms
                      </span>
                      {span.statusCode === "ERROR" ? (
                        <AlertCircle size={14} className="text-rose-400" />
                      ) : (
                        <CheckCircle size={14} className="text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* Latency timing bar */}
                  <div className="w-full bg-slate-900 h-2 rounded-full mt-2.5 overflow-hidden p-0.5 border border-slate-800/60">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        span.statusCode === "ERROR"
                          ? "bg-gradient-to-r from-rose-500 to-red-600"
                          : span.durationMs > 100
                          ? "bg-gradient-to-r from-amber-400 to-orange-500"
                          : "bg-gradient-to-r from-sky-400 to-blue-500"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Span Detail Inspector */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white tracking-wide">Span Inspector</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold uppercase">
              TRACE NODE
            </span>
          </div>

          {selectedSpan ? (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Service Entity</span>
                <div className="font-bold text-white text-sm flex items-center justify-between mt-1">
                  <span>{selectedSpan.serviceName}</span>
                  <button
                    onClick={() => onSelectService(selectedSpan.serviceName)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-normal inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20"
                  >
                    <span>View in 3D</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Operation / Method</span>
                <div className="font-mono text-slate-200 mt-1 p-2 rounded bg-slate-950 border border-slate-800 break-all text-[11px] font-semibold text-sky-300">
                  {selectedSpan.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Duration</span>
                  <div className="font-mono text-amber-300 font-bold text-sm mt-0.5">{selectedSpan.durationMs} ms</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Status Code</span>
                  <div className={`font-mono font-bold text-sm mt-0.5 ${selectedSpan.statusCode === "ERROR" ? "text-rose-400" : "text-emerald-400"}`}>
                    {selectedSpan.statusCode}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Trace ID</span>
                <div className="flex items-center justify-between gap-1 font-mono text-slate-300 text-[11px] p-2 rounded bg-slate-950 border border-slate-800 mt-1">
                  <span className="truncate">{selectedSpan.traceId}</span>
                  <button
                    onClick={() => handleCopy(selectedSpan.traceId, "trace")}
                    className="text-slate-400 hover:text-white shrink-0 p-1 rounded"
                    title="Copy Trace ID"
                  >
                    {copiedId === "trace" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Span ID</span>
                <div className="flex items-center justify-between gap-1 font-mono text-slate-300 text-[11px] p-2 rounded bg-slate-950 border border-slate-800 mt-1">
                  <span className="truncate">{selectedSpan.spanId}</span>
                  <button
                    onClick={() => handleCopy(selectedSpan.spanId, "span")}
                    className="text-slate-400 hover:text-white shrink-0 p-1 rounded"
                    title="Copy Span ID"
                  >
                    {copiedId === "span" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {selectedSpan.peerService && (
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Downstream Target</span>
                  <div className="text-sky-300 font-semibold mt-1 flex items-center gap-1.5 text-xs">
                    <ArrowRight size={13} className="text-sky-400" />
                    <span>{selectedSpan.peerService}</span>
                  </div>
                </div>
              )}

              {Object.keys(selectedSpan.attributes).length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider block">Span Attributes</span>
                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono max-h-36 overflow-y-auto">
                    {Object.entries(selectedSpan.attributes).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-1 py-0.5 border-b border-slate-900/60 last:border-0">
                        <span className="text-sky-400 font-medium">{k}:</span>
                        <span className="text-slate-300 truncate font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 p-8 text-center border border-dashed border-slate-800 rounded-lg">
              Select a span from the waterfall to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
