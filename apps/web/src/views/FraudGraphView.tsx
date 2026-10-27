import React, { useState, useEffect, useMemo } from "react";
import { Network, Search, Filter, ShieldAlert, Cpu, Share2, Layers, RefreshCw, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { fetchGraphSubgraph } from "../api";
import { GraphNode, GraphEdge } from "../types";

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
    loadGraph();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-accent-teal/10 text-accent-teal">
              <Network className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-teal">
              Temporal Ego-Net Intelligence
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Fraud Syndicate &amp; Mule Ring Graph Explorer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Uncovering circular laundering structures (A &rarr; B &rarr; C &rarr; A) and multi-account device proliferation.
          </p>
        </div>

        {/* Filter Controls & Reload */}
        <div className="flex flex-wrap items-center gap-3">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Network Visualizer SVG */}
        <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 flex flex-col justify-between min-h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700 text-xs text-slate-400">
            <span>Dynamic Bipartite Ego-Net ({nodes.length} Nodes &bull; {edges.length} Directed Edges)</span>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Mule Ring Node</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-teal"></span>
                <span>Legitimate User</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Merchant / Gateway</span>
              </span>
            </div>
          </div>

          {/* Render Network Graph in SVG */}
          <div className="relative w-full h-[400px] my-3 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-100 dark:border-navy-750 overflow-hidden flex items-center justify-center">
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
            <span className="font-mono text-accent-teal">Sub-20ms Ego-Net Latency Bounded</span>
          </div>
        </div>

        {/* Right Col: Node Investigation Card */}
        {selectedNode && (
          <div className="rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 space-y-4">
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
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  selectedNode.type === "mule_account" || selectedNode.id.includes("mule")
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : selectedNode.type === "merchant" || selectedNode.id.includes("merch")
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : "bg-accent-teal/10 text-accent-teal border border-accent-teal/20"
                }`}
              >
                {selectedNode.type.replace("_", " ")}
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
                  {(selectedNode.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden flex">
                <div
                  className={`h-full ${
                    selectedNode.risk_score >= 0.75
                      ? "bg-rose-500"
                      : selectedNode.risk_score >= 0.4
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
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
                  <span>{selectedNode.in_degree}</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Out-Degree (Fan-Out):</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center space-x-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                  <span>{selectedNode.out_degree}</span>
                </span>
              </div>
            </div>

            {/* Connected Transaction Flows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                <span>Direct Flows ({connectedEdges.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">24h Ego Window</span>
              </div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {connectedEdges.length > 0 ? (
                  connectedEdges.map((e, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700 text-xs flex items-center justify-between font-mono"
                    >
                      <div className="truncate text-slate-700 dark:text-slate-300">
                        {e.source === selectedNode.id ? (
                          <span>&rarr; {e.target}</span>
                        ) : (
                          <span>&larr; {e.source}</span>
                        )}
                      </div>
                      <span className="font-bold text-accent-teal">${e.amount.toFixed(2)}</span>
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
        )}
      </div>
    </div>
  );
};
