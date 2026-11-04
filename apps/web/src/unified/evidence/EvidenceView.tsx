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
}) => {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-950">
      {/* Evidence & Review Sub-Navigation Rail */}
      <div className="h-11 shrink-0 border-b border-slate-800/80 bg-slate-900/70 px-4 lg:px-6 flex items-center justify-between gap-4">
        <nav aria-label="Evidence Sections" className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            onClick={() => onChangeSubview("findings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "findings"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <ShieldCheck size={13} />
            <span>Findings</span>
          </button>

          <button
            onClick={() => onChangeSubview("sources")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "sources"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <BookOpen size={13} />
            <span>Sources</span>
          </button>

          <button
            onClick={() => onChangeSubview("evidence")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "evidence"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <FileText size={13} />
            <span>Telemetry & Records</span>
          </button>

          <button
            onClick={() => onChangeSubview("reviews")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "reviews"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Award size={13} />
            <span>Reviews</span>
          </button>

          <button
            onClick={() => onChangeSubview("exchange")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "exchange"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Send size={13} />
            <span>Share & Exchange</span>
          </button>

          <button
            onClick={() => onChangeSubview("quality")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subview === "quality"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Gauge size={13} />
            <span>Quality & Benchmarks</span>
          </button>
        </nav>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Integrity:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>SHA-256 Attested</span>
          </span>
        </div>
      </div>

      {/* Main Viewport Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
        {subview === "findings" && (
          <FindingsSubView onNavigateWorkspace={onNavigateWorkspace} />
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
