/**
 * Atlas — Design System reference route (Task 03.5): a live component
 * showcase so every feature uses the system instead of isolated styling.
 */

import React from "react";
import { APanel, ABadge, AButton, AMetric, AInput, ASelect, AAnnouncer } from "../ui";

export const DesignSystemView: React.FC = () => (
  <div className="h-full overflow-y-auto p-4">
    <header className="mb-4">
      <h1 className="text-lg font-black text-slate-100">Design System</h1>
      <p className="text-xs text-slate-400">
        The Atlas component vocabulary: surfaces (slate-950 canvas / slate-900 panels), restrained semantic accents,
        status = label + icon + color (never color alone), focus-visible outlines on every interactive element.
      </p>
    </header>

    <div className="grid gap-3 md:grid-cols-2">
      <APanel title="Buttons" subtitle="Primary / default / danger, with disabled and focus states">
        <div className="flex flex-wrap gap-2">
          <AButton variant="primary">Primary action</AButton>
          <AButton>Default</AButton>
          <AButton variant="danger">Danger</AButton>
          <AButton disabled>Disabled</AButton>
        </div>
      </APanel>

      <APanel title="Status badges" subtitle="Meaning is carried by label + icon + color together">
        <div className="flex flex-wrap gap-2">
          <ABadge status="ok" label="Independently validated" />
          <ABadge status="warn" label="Findings disputed" />
          <ABadge status="bad" label="Failed" />
          <ABadge status="info" label="Assessment received" />
          <ABadge status="unknown" label="Not yet reviewed" />
        </div>
      </APanel>

      <APanel title="Metrics" subtitle="Data-backed only — the source is in the hint line">
        <div className="grid grid-cols-2 gap-2">
          <AMetric label="Components" value={11} hint="canonical model" />
          <AMetric label="Findings" value={3} hint="critic engine" />
        </div>
      </APanel>

      <APanel title="Inputs" subtitle="Labels are always visible or programmatically bound">
        <div className="space-y-2">
          <AInput aria-label="Example input" placeholder="Text input" />
          <ASelect aria-label="Example select">
            <option>Select…</option><option>Option A</option>
          </ASelect>
        </div>
      </APanel>

      <APanel title="Announcer" subtitle="Polite live region for dynamic results">
        <AAnnouncer message="This is what screen readers receive after each action." />
        <p className="text-xs text-slate-400">role=status, aria-live=polite — data-bearing copy, no focus stealing, no repeats of unchanged content.</p>
      </APanel>

      <APanel title="Interaction standards" subtitle="Applies to every control in Atlas">
        <ul className="text-xs text-slate-300 space-y-1 list-disc ml-4">
          <li>Hover: subtle surface change; cursor change only where meaningful.</li>
          <li>Focus: 2px sky-400 focus-visible outline (keyboard users always see it).</li>
          <li>Disabled: 40% opacity + not-allowed cursor + honest tooltip/state.</li>
          <li>Loading/empty: explicit text (“No scenario run yet — press Run scenario”), never fake data.</li>
          <li>Destructive: confirmation dialog with reversibility notes (undo).</li>
        </ul>
      </APanel>
    </div>
  </div>
);
