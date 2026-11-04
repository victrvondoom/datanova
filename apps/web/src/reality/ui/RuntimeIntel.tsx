/**
 * Campaign 07 — Task 12 & 19: Runtime Intelligence & Trace Explorer
 *
 * Live service topology table, interactive trace waterfall, span inspector,
 * and direct spatial linking to architecture nodes.
 */

import React, { useState } from "react";
import {
  Layers, Search, Clock, ArrowRight, AlertCircle, CheckCircle, ExternalLink,
  CornerDownRight
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

  const filteredSpans = spans.filter(
    (s) =>
      s.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.traceId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSpan = spans.find((s) => s.spanId === selectedSpanId) || spans[0];
  const maxDuration = Math.max(1, ...spans.map((s) => s.durationMs));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Runtime Intelligence & Trace Explorer</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect reconstructed service interactions, trace waterfalls, and timing breakdowns derived from actual telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Window:</span>
          <span className="text-sky-300">
            {observedGraph.windowStart.slice(11, 19)} &rarr; {observedGraph.windowEnd.slice(11, 19)}
          </span>
        </div>
      </div>

      {/* Observed Service Topology Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={16} className="text-sky-400" />
            <span>Active Runtime Services ({observedGraph.nodes.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {observedGraph.edges.length} Communicating Edges
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
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
                  <tr key={node.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{node.name}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{node.kind}</td>
                    <td className="py-2.5 px-3 font-mono">{totalCalls} calls</td>
                    <td className="py-2.5 px-3 font-mono text-amber-300">{avgP95} ms</td>
                    <td className="py-2.5 px-3 font-mono">
                      {totalErrors > 0 ? (
                        <span className="text-rose-400 font-bold">{totalErrors} errors</span>
                      ) : (
                        <span className="text-emerald-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectService(node.name)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <span>Inspect in 3D</span>
                        <ExternalLink size={12} />
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
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-sky-400" />
              <span>Trace Waterfall ({filteredSpans.length} Spans)</span>
            </h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter service or trace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredSpans.map((span) => {
              const widthPct = Math.max(8, Math.round((span.durationMs / maxDuration) * 100));
              const isSelected = span.spanId === selectedSpan?.spanId;
              const isChild = !!span.parentSpanId;

              return (
                <div
                  key={span.spanId}
                  onClick={() => setSelectedSpanId(span.spanId)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-500/15"
                      : "border-slate-800/80 bg-slate-950/70 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      {isChild && <CornerDownRight size={13} className="text-slate-500 ml-1 shrink-0" />}
                      <span className="font-bold text-white truncate">{span.serviceName}</span>
                      <span className="text-slate-400 truncate">&bull; {span.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                      <span className={span.durationMs > 100 ? "text-amber-400 font-bold" : "text-slate-400"}>
                        {span.durationMs} ms
                      </span>
                      {span.statusCode === "ERROR" ? (
                        <AlertCircle size={13} className="text-rose-400" />
                      ) : (
                        <CheckCircle size={13} className="text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* Latency timing bar */}
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        span.statusCode === "ERROR" ? "bg-rose-500" : span.durationMs > 100 ? "bg-amber-400" : "bg-sky-400"
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Span Inspector</h3>

          {selectedSpan ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Service Name</span>
                <div className="font-bold text-white text-sm flex items-center gap-2 mt-0.5">
                  <span>{selectedSpan.serviceName}</span>
                  <button
                    onClick={() => onSelectService(selectedSpan.serviceName)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-normal inline-flex items-center gap-0.5"
                  >
                    <span>View in 3D</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Operation</span>
                <div className="font-mono text-slate-200 mt-0.5 break-all">{selectedSpan.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase">Duration</span>
                  <div className="font-mono text-amber-300 font-semibold mt-0.5">{selectedSpan.durationMs} ms</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase">Status</span>
                  <div className={`font-mono font-semibold mt-0.5 ${selectedSpan.statusCode === "ERROR" ? "text-rose-400" : "text-emerald-400"}`}>
                    {selectedSpan.statusCode}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Trace ID</span>
                <div className="font-mono text-slate-300 text-[11px] truncate mt-0.5">{selectedSpan.traceId}</div>
              </div>

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase">Span ID</span>
                <div className="font-mono text-slate-300 text-[11px] truncate mt-0.5">{selectedSpan.spanId}</div>
              </div>

              {selectedSpan.peerService && (
                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase">Downstream Target</span>
                  <div className="text-sky-300 font-semibold mt-0.5 flex items-center gap-1">
                    <ArrowRight size={12} />
                    <span>{selectedSpan.peerService}</span>
                  </div>
                </div>
              )}

              {Object.keys(selectedSpan.attributes).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-slate-500 font-mono text-[10px] uppercase">Attributes</span>
                  <div className="space-y-1 bg-slate-950/80 p-2.5 rounded border border-slate-800 text-[11px] font-mono max-h-36 overflow-y-auto">
                    {Object.entries(selectedSpan.attributes).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-1">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-200 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Select a span from the waterfall to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
};
