/**
 * DataNova Campaign 08 — Destination 3: Evidence & Review View
 *
 * The central validation environment unifying:
 * 1. Findings (Cross-system findings ledger)
 * 2. Sources (Externally grounded literature and specifications)
 * 3. Evidence (Cryptographic envelopes, telemetry observations, and records)
 * 4. Reviews (Multi-party reviewer room and formal sign-offs)
 * 5. Share & Exchange (Evidence package export/import with SHA-256 integrity)
 * 6. Quality & Benchmarks (Benchmark runs, validation coverage, limitations)
 *
 * Styled in luxury creamy white and creamy black aesthetic with cursive typography.
 */

import React from "react";
import {
  ShieldCheck, FileText, BookOpen, Send, Gauge,
  CheckCircle2, Award
} from "lucide-react";
import type { EvidenceSubView as EvidenceSubViewType } from "../types";
import type { Project } from "../../atlas/state";
import type { ArchitectureModel } from "../../lab/model";
import type { ReviewRecord } from "../../atlas/validation";
import type { AtlasSection } from "../../atlas/router";

import { FindingsSubView } from "./FindingsSubView";
import { EvidenceSubView } from "./EvidenceSubView";
import { SourcesView } from "../../atlas/views/Sources";
import { ValidationRoomView } from "../../atlas/views/ValidationRoom";
import { ExchangeView } from "../../atlas/views/Exchange";
import { BenchmarksView } from "../../atlas/views/Benchmarks";

interface EvidenceViewProps {
  subview: EvidenceSubViewType;
  onChangeSubview: (sub: EvidenceSubViewType) => void;
  project: Project;
  model: ArchitectureModel;
  reviews: Record<string, ReviewRecord[]>;
  onRecordReview: (record: ReviewRecord) => void;
  onNavigateAtlas: (sec: AtlasSection) => void;
  onAdoptModel: (model: ArchitectureModel) => void;
  onNavigateWorkspace: (subview: string) => void;
  setAnnounce?: (msg: string) => void;
  darkMode?: boolean;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  subview,
  onChangeSubview,
  project,
  model,
  reviews,
  onRecordReview,
  onNavigateAtlas,
  onAdoptModel,
  onNavigateWorkspace,
  setAnnounce = () => {},
  darkMode = true,
}) => {
  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden transition-colors ${
      darkMode ? "bg-[#0c0c0e] text-[#f4f4f5]" : "bg-[#fbfaf8] text-[#111113]"
    }`}>
      {/* Evidence & Review Sub-Navigation Rail */}
      <div className={`h-11 shrink-0 border-b px-4 lg:px-6 flex items-center justify-between gap-4 transition-colors ${
        darkMode ? "border-[#27272a] bg-[#121214]/95" : "border-[#e4e2dd] bg-[#ffffff]/95"
      }`}>
        <nav aria-label="Evidence Sections" className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            onClick={() => onChangeSubview("findings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "findings"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <ShieldCheck size={13} />
            <span>Findings</span>
          </button>

          <button
            onClick={() => onChangeSubview("sources")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "sources"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <BookOpen size={13} />
            <span>Sources</span>
          </button>

          <button
            onClick={() => onChangeSubview("evidence")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "evidence"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <FileText size={13} />
            <span>Telemetry & Records</span>
          </button>

          <button
            onClick={() => onChangeSubview("reviews")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "reviews"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <Award size={13} />
            <span>Reviews</span>
          </button>

          <button
            onClick={() => onChangeSubview("exchange")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "exchange"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <Send size={13} />
            <span>Share & Exchange</span>
          </button>

          <button
            onClick={() => onChangeSubview("quality")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subview === "quality"
                ? darkMode
                  ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                  : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                : darkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <Gauge size={13} />
            <span>Quality & Benchmarks</span>
          </button>
        </nav>

        <div className={`hidden sm:flex items-center gap-2 text-xs font-mono ${
          darkMode ? "text-zinc-400" : "text-zinc-600"
        }`}>
          <span>Integrity:</span>
          <span className="text-emerald-500 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>SHA-256 Attested</span>
          </span>
        </div>
      </div>

      {/* Main Viewport Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
        {subview === "findings" && (
          <FindingsSubView onNavigateWorkspace={onNavigateWorkspace} darkMode={darkMode} />
        )}

        {subview === "sources" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <SourcesView />
          </div>
        )}

        {subview === "evidence" && (
          <EvidenceSubView />
        )}

        {subview === "reviews" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <ValidationRoomView
              model={model}
              project={project}
              reviews={reviews[project.id] ?? []}
              onRecordReview={onRecordReview}
              setAnnounce={setAnnounce}
            />
          </div>
        )}

        {subview === "exchange" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <ExchangeView
              model={model}
              onNavigate={onNavigateAtlas}
              onAdoptModel={onAdoptModel}
            />
          </div>
        )}

        {subview === "quality" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <BenchmarksView />
          </div>
        )}
      </div>
    </div>
  );
};
