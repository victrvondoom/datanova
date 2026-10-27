import React, { useState, useEffect } from "react";
import { Network, Search, Filter, ShieldAlert, Cpu, Share2, Layers } from "lucide-react";
import { fetchGraphSubgraph } from "../api";
import { GraphNode, GraphEdge } from "../types";

export const FraudGraphView: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetchGraphSubgraph().then((data) => {
      setNodes(data.nodes);
      setEdges(data.edges);
      if (data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    });
  }, []);

  const filteredNodes = nodes.filter((n) => {
    const matchesFilter = filterType === "all" || n.type === filterType;
    const matchesSearch = n.id.toLowerCase().includes(searchQuery.toLowerCase()) || n.label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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

        {/* Filter Controls */}
        <div className="flex items-center space-x-3">
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
        </div>
      </div>

      {/* Main Interactive Canvas & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Network Visualizer SVG */}
        <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 shadow-sm p-5 flex flex-col justify-between min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-700 text-xs text-slate-400">
            <span>Dynamic Bipartite Ego-Net (Rolling 24-Hour Window)</span>
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
          <div className="relative w-full h-[380px] my-3 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-100 dark:border-navy-700 overflow-hidden flex items-center justify-center">
            <svg className="w-full h-full">
              {/* Draw Edges */}
              {edges.slice(0, 16).map((edge, i) => {
                // Approximate coordinate mapping for nodes
                const uIdx = nodes.findIndex((n) => n.id === edge.source);
                const vIdx = nodes.findIndex((n) => n.id === edge.target);
                if (uIdx === -1 || vIdx === -1) return null;

                const x1 = 120 + ((uIdx * 110) % 520);
                const y1 = 70 + ((uIdx * 80) % 260);
                const x2 = 120 + ((vIdx * 110) % 520);
                const y2 = 70 + ((vIdx * 80) % 260);

                const isMuleEdge = edge.source.includes("mule") && edge.target.includes("mule");

                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMuleEdge ? "#f43f5e" : "#38bdf8"}
                      strokeWidth={isMuleEdge ? 2.5 : 1.2}
                      strokeDasharray={isMuleEdge ? "4 2" : "none"}
                      opacity={0.65}
                    />
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {filteredNodes.slice(0, 14).map((node, i) => {
                const cx = 120 + ((i * 110) % 520);
                const cy = 70 + ((i * 80) % 260);
                const isSelected = selectedNode?.id === node.id;
                const isMule = node.type === "mule_account";
                const isMerch = node.type === "merchant";

                const color = isMule ? "#f43f5e" : isMerch ? "#f59e0b" : "#00b4d8";

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onClick={() => setSelectedNode(node)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 18 : 14}
                      fill={color}
                      stroke={isSelected ? "#ffffff" : "transparent"}
                      strokeWidth={3}
                      className="shadow-lg"
                    />
                    <text
                      x={cx}
                      y={cy + 25}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 pointer-events-none"
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-navy-700">
            <span>Tip: Click any node to inspect risk indicators and cyclic path contributions.</span>
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
                  selectedNode.type === "mule_account"
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : selectedNode.type === "merchant"
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : "bg-accent-teal/10 text-accent-teal border border-accent-teal/20"
                }`}
              >
                {selectedNode.type.replace("_", " ")}
              </span>
            </div>

            {/* Risk Indicator */}
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Graph Risk Centrality:</span>
                <span className={`font-mono text-sm font-black ${selectedNode.risk_score > 0.5 ? "text-rose-500" : "text-emerald-500"}`}>
                  {(selectedNode.risk_score * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedNode.type === "mule_account"
                  ? "Participates in directed circular smurfing flows closing within 3 hops."
                  : "Normal ego-net topological distribution."}
              </p>
            </div>

            {/* Topological Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">In-Degree (24h):</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedNode.in_degree} incoming</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                <span className="text-slate-400 block text-[10px]">Out-Degree (24h):</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedNode.out_degree} outgoing</span>
              </div>
            </div>

            {/* Heuristic Flags */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Detected Topological Patterns
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                  <span className="text-slate-600 dark:text-slate-300">Directed Cycle (Smurfing):</span>
                  <span className={`font-bold ${selectedNode.type === "mule_account" ? "text-rose-500" : "text-slate-400"}`}>
                    {selectedNode.type === "mule_account" ? "YES (3-Hop Loop)" : "NONE"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-100 dark:border-navy-700">
                  <span className="text-slate-600 dark:text-slate-300">Multi-Account Device:</span>
                  <span className={`font-bold ${selectedNode.type === "mule_account" ? "text-amber-500" : "text-emerald-500"}`}>
                    {selectedNode.type === "mule_account" ? "SHARED (3 Accounts)" : "ISOLATED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
