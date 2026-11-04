import React, { useState, useEffect, useMemo } from "react";
import { Network, Search, ShieldAlert, RefreshCw, ArrowUpRight, ArrowDownLeft, Store, User, Smartphone, Zap } from "lucide-react";
import { fetchGraphSubgraph } from "../api";
import { GraphNode, GraphEdge } from "../types";
import { useCountUp } from "../lib/useCountUp";
import { formatKpiValue } from "../lib/ultra";

/** Animated integer readout (node/edge/degree counts). Presentation-only. */
const AnimatedCount: React.FC<{ value: number; durationMs?: number }> = ({ value, durationMs = 900 }) => {
  const animated = useCountUp(value, { durationMs });
  return <>{formatKpiValue(animated, { decimals: 0 })}</>;
};

/** Animated currency readout for transaction flow amounts. */
const AnimatedMoney: React.FC<{ value: number }> = ({ value }) => {
  const animated = useCountUp(value, { durationMs: 800 });
  return <>{formatKpiValue(animated, { decimals: 2, prefix: "$" })}</>;
};

/** Animated percentage readout (risk score). */
const AnimatedPercent: React.FC<{ value: number }> = ({ value }) => {
  const animated = useCountUp(value, { durationMs: 1100 });
  return <>{formatKpiValue(animated, { decimals: 0, suffix: "%" })}</>;
};

export const FraudGraphView: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = await fetchGraphSubgraph();
      setNodes(data.nodes);
      setEdges(data.edges);
      if (data.nodes.length > 0) {
        // Select first mule node or first node
        const firstMule = data.nodes.find((n) => n.id.includes("mule")) || data.nodes[0];
        setSelectedNode(firstMule);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // deferred off the render commit (avoids cascading setState in the
    // effect body)
    const t = window.setTimeout(() => loadGraph(), 0);
    return () => window.clearTimeout(t);
  }, []);

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesFilter = filterType === "all" || n.type === filterType;
      const matchesSearch =
        n.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.label.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [nodes, filterType, searchQuery]);

  // Compute organic coordinates for nodes in SVG canvas (width 700, height 400)
  const nodePositions = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const width = 720;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    const muleNodes = nodes.filter((n) => n.id.includes("mule"));
    const otherNodes = nodes.filter((n) => !n.id.includes("mule"));

    // Place mule ring in inner circle (radius 90)
    muleNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, muleNodes.length)) * 2 * Math.PI - Math.PI / 2;
      coords[n.id] = {
        x: centerX + Math.cos(angle) * 110,
        y: centerY + Math.sin(angle) * 90,
      };
    });

    // Place other nodes in outer orbital ellipse
    otherNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, otherNodes.length)) * 2 * Math.PI;
      const rX = 260 + (i % 3) * 25;
      const rY = 150 + (i % 2) * 20;
      coords[n.id] = {
        x: Math.max(40, Math.min(width - 40, centerX + Math.cos(angle) * rX)),
        y: Math.max(30, Math.min(height - 30, centerY + Math.sin(angle) * rY)),
      };
    });

    return coords;
  }, [nodes]);

  // Connected edges for selected node
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id);
  }, [selectedNode, edges]);

  return (
    <div className="space-y-6 ultra-stagger">
      {/* Header */}
      <div className="relative ultra-card ultra-crown overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
        <div className="ultra-grid-overlay absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-accent-teal/10 text-accent-teal">
              <Network className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-teal">
              Temporal Ego-Net Intelligence
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Fraud Syndicate &amp; Mule Ring <span className="ultra-shimmer-text">Graph Explorer</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Uncovering circular laundering structures (A &rarr; B &rarr; C &rarr; A) and multi-account device proliferation.
          </p>
        </div>

        {/* Filter Controls & Reload */}
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search account / device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-accent-teal"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Entities</option>
            <option value="mule_account">Mule Rings Only</option>
            <option value="account">Legitimate Accounts</option>
            <option value="merchant">Merchants</option>
            <option value="device">Devices</option>
          </select>

          <button
            onClick={loadGraph}
            disabled={loading}
            className="p-2 rounded-xl border bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent-teal" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ultra-stagger">
        {/* Left 2 Cols: Network Visualizer SVG */}
        <div className="ultra-card ultra-gradient-ring lg:col-span-2 p-5 flex flex-col justify-between min-h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700 text-xs text-slate-400">
            <span>Dynamic Bipartite Ego-Net (<AnimatedCount value={nodes.length} /> Nodes &bull; <AnimatedCount value={edges.length} /> Directed Edges)</span>
            <div className="flex items-center space-x-2">
              <span className="ultra-chip text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Mule Ring Node</span>
              </span>
              <span className="ultra-chip text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-teal"></span>
                <span>Legitimate User</span>
              </span>
              <span className="ultra-chip text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Merchant / Gateway</span>
              </span>
            </div>
          </div>

          {/* Render Network Graph in SVG */}
          <div className="ultra-grid-overlay relative w-full h-[400px] my-3 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-100 dark:border-navy-750 overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 720 400" className="w-full h-full select-none">
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" opacity="0.6" />
                </marker>
                <marker
                  id="arrow-mule"
                  viewBox="0 0 10 10"
                  refX="20"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                </marker>
              </defs>

              {/* Draw Edges */}
              {edges.map((edge, i) => {
                const p1 = nodePositions[edge.source];
                const p2 = nodePositions[edge.target];
                if (!p1 || !p2) return null;

                const isMuleEdge = edge.source.includes("mule") && edge.target.includes("mule");
                const isConnected =
                  selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isConnected ? "#38bdf8" : isMuleEdge ? "#f43f5e" : "#475569"}
                      strokeWidth={isConnected ? 3 : isMuleEdge ? 2.2 : 1.2}
                      strokeDasharray={isMuleEdge ? "5 3" : "none"}
                      opacity={isConnected ? 1.0 : isMuleEdge ? 0.85 : 0.45}
                      markerEnd={isMuleEdge ? "url(#arrow-mule)" : "url(#arrow-default)"}
                    />
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {filteredNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const isSelected = selectedNode?.id === node.id;
                const isMule = node.type === "mule_account" || node.id.includes("mule");
                const isMerch = node.type === "merchant" || node.id.includes("merch") || node.id.includes("exchange");

                const color = isMule ? "#f43f5e" : isMerch ? "#f59e0b" : "#00b4d8";

                return (
                  <g
                    key={`node-${node.id}`}
                    className="cursor-pointer transition-transform hover:scale-115"
                    onClick={() => setSelectedNode(node)}
                  >
                    {isMule && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? 24 : 18}
                        fill="#f43f5e"
                        opacity={0.2}
                        className="animate-ping"
                      />
                    )}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 16 : isMule ? 14 : 12}
                      fill={color}
                      stroke={isSelected ? "#ffffff" : isMule ? "#f43f5e" : "transparent"}
                      strokeWidth={isSelected ? 3 : 1}
                      className="shadow-lg"
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 22}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-200 pointer-events-none drop-shadow-xs"
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-navy-700">
            <span>Tip: Click any node to highlight immediate counterparties and flow volumes.</span>
            <span className="ultra-chip font-mono text-accent-teal">
              <Zap className="w-3 h-3 shrink-0" />
              <span>Sub-20ms Ego-Net Latency Bounded</span>
            </span>
          </div>
        </div>

        {/* Right Col: Node Investigation Card */}
        {selectedNode && (() => {
          const isMuleNode = selectedNode.type === "mule_account" || selectedNode.id.includes("mule");
          const isMerchNode = selectedNode.type === "merchant" || selectedNode.id.includes("merch") || selectedNode.id.includes("exchange");
          const isDeviceNode = selectedNode.type === "device";
          const ChipIcon = isMuleNode ? ShieldAlert : isMerchNode ? Store : isDeviceNode ? Smartphone : User;
          return (
          <div className="ultra-card ultra-crown p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Node Investigation
                </span>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {selectedNode.id}
                </div>
              </div>
              <span
                className={`ultra-chip uppercase font-bold ${
                  isMuleNode
                    ? "text-rose-500 border-rose-500/30 bg-rose-500/10"
                    : isMerchNode
                    ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                    : "text-accent-teal border-accent-teal/30 bg-accent-teal/10"
                }`}
              >
                <ChipIcon className="w-3 h-3 shrink-0" />
                <span>{selectedNode.type.replace("_", " ")}</span>
              </span>
            </div>

            {/* Risk Score */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Node Structural Risk Score:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedNode.risk_score >= 0.75
                      ? "text-rose-500"
                      : selectedNode.risk_score >= 0.4
                      ? "text-amber-500"
                      : "text-emerald-500"
                  }`}
                >
                  <AnimatedPercent value={selectedNode.risk_score * 100} />
                </span>
              </div>
              <div className="ultra-progress-track w-full h-2">
                <div
                  className="ultra-progress-fill"
                  style={{ width: `${selectedNode.risk_score * 100}%` }}
                />
              </div>
            </div>

            {/* Degree & Topology Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">In-Degree (Fan-In):</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center space-x-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-accent-teal" />
                  <span><AnimatedCount value={selectedNode.in_degree} /></span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Out-Degree (Fan-Out):</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center space-x-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                  <span><AnimatedCount value={selectedNode.out_degree} /></span>
                </span>
              </div>
            </div>

            {/* Connected Transaction Flows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                <span>Direct Flows (<AnimatedCount value={connectedEdges.length} />)</span>
                <span className="text-[10px] text-slate-400 font-normal">24h Ego Window</span>
              </div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {connectedEdges.length > 0 ? (
                  connectedEdges.map((e, idx) => (
                    <div
                      key={idx}
                      className="ultra-row p-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700 text-xs flex items-center justify-between font-mono"
                    >
                      <div className="truncate text-slate-700 dark:text-slate-300">
                        {e.source === selectedNode.id ? (
                          <span>&rarr; {e.target}</span>
                        ) : (
                          <span>&larr; {e.source}</span>
                        )}
                      </div>
                      <span className="font-bold text-accent-teal"><AnimatedMoney value={e.amount} /></span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 p-2 italic">No active direct flows in 24h window.</div>
                )}
              </div>
            </div>

            {/* Syndicate Loop Indicator */}
            {selectedNode.id.includes("mule") && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Circular Laundering Ring Detected</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  NetworkX 2-to-3 hop cycle detection confirms circular smurfing topology (A &rarr; B &rarr; C &rarr; A).
                </p>
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
};
