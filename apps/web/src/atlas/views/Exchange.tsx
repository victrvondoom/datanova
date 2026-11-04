/**
 * Atlas — Evidence Exchange (Task 32): the Campaign-05 DEP workflow mounted
 * in the Atlas product shell. Real package build/validate/import/adopt
 * behavior — reusing the verified lab panel rather than duplicating it
 * (campaign rule 3.2: preserve existing engines).
 */

import React from "react";
import { parseModel, type ArchitectureModel } from "../../lab/model";
import { ExchangePanel } from "../../lab/panels/Exchange";
import { APanel } from "../ui";

export const ExchangeView: React.FC<{
  model: ArchitectureModel;
  onNavigate: (s: "studio" | "validation") => void;
  onAdoptModel?: (m: ArchitectureModel) => void;
}> = ({ model, onNavigate, onAdoptModel }) => (
  <div className="h-full overflow-y-auto p-4">
    <header className="mb-4">
      <h1 className="text-lg font-black text-slate-100">Evidence Exchange</h1>
      <p className="text-xs text-slate-400">
        Portable, integrity-checked, privacy-scanned evidence packages (DEP v1) — deterministic export, staged import,
        reviewer annotations, digest-bound responses, and the provenance chain. File-based, offline, no cloud service.
      </p>
    </header>
    <APanel title="Workflow" subtitle="How exchange connects to the rest of Atlas">
      <ol className="text-xs text-slate-300 list-decimal ml-5 space-y-0.5">
        <li>Export a package from the working architecture (below).</li>
        <li>Transfer the file to another user by any channel.</li>
        <li>The recipient validates, previews, and stages adoption — their workspace is untouched until accepted.</li>
        <li>They annotate findings and return a digest-bound review response.</li>
        <li>Import the response here, then record assessments in the <button className="text-sky-300 underline" onClick={() => onNavigate("validation")}>Validation Room</button> and inspect provenance below.</li>
        <li>Continue editing in the <button className="text-sky-300 underline" onClick={() => onNavigate("studio")}>Studio</button>.</li>
      </ol>
    </APanel>
    <ExchangePanel
      model={model}
      onAdoptJson={(json) => {
        if (onAdoptModel) {
          onAdoptModel(parseModel(json));
          onNavigate("studio");
        }
      }}
    />
  </div>
);
