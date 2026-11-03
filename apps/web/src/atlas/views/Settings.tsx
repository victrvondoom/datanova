/**
 * Atlas — Settings (Task 06): workspace management — create/rename/archive/
 * duplicate projects, view preferences, and local-data controls.
 */

import React from "react";
import type { AtlasState } from "../state";
import type { ReviewRecord } from "../validation";
import { APanel, AButton, ABadge, AInput } from "../ui";

export const SettingsView: React.FC<{
  state: AtlasState;
  reviews: Record<string, ReviewRecord[]>;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSelect: (id: string) => void;
  setAnnounce: (m: string) => void;
}> = ({ state, reviews, onRename, onArchive, onDuplicate, onSelect, setAnnounce }) => (
  <div className="h-full overflow-y-auto p-4">
    <header className="mb-4">
      <h1 className="text-lg font-black text-slate-100">Settings</h1>
      <p className="text-xs text-slate-400">
        All Atlas data (architectures, panel preferences, review records) is stored locally in this browser — nothing leaves the machine.
      </p>
    </header>

    <APanel title="Workspaces" subtitle="Create, rename, duplicate, archive — the active workspace is marked">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-400"><th className="py-1">Name</th><th>Version</th><th>Reviews</th><th>State</th><th>Actions</th></tr></thead>
        <tbody>
          {state.projects.map((p) => (
            <tr key={p.id} className="border-t border-slate-800">
              <td className="py-1.5">
                <AInput defaultValue={p.name} aria-label={`Rename ${p.name}`}
                  onBlur={(e) => { if (e.target.value !== p.name) { onRename(p.id, e.target.value); setAnnounce("Workspace renamed."); } }} />
              </td>
              <td>v{p.version}</td>
              <td>{reviews[p.id]?.length ?? 0}</td>
              <td>
                {p.id === state.activeProjectId && <ABadge status="ok" label="active" />}
                {p.archived && <ABadge status="warn" label="archived" />}
                {state.unsaved[p.id] && <ABadge status="warn" label="unsaved" />}
              </td>
              <td className="space-x-1 whitespace-nowrap">
                <AButton onClick={() => { onSelect(p.id); setAnnounce(`Switched to ${p.name}.`); }} disabled={p.id === state.activeProjectId}>Activate</AButton>
                <AButton onClick={() => { onDuplicate(p.id); setAnnounce("Workspace duplicated."); }}>Duplicate</AButton>
                <AButton onClick={() => { onArchive(p.id); setAnnounce(p.archived ? "Workspace restored." : "Workspace archived."); }}>
                  {p.archived ? "Restore" : "Archive"}
                </AButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </APanel>

    <APanel title="Local data" subtitle="Honest persistence facts">
      <ul className="text-xs text-slate-300 space-y-1 list-disc ml-4">
        <li>Storage keys: <code className="text-sky-300">datanova-atlas-v1</code> (workspaces, panels) and <code className="text-sky-300">datanova-atlas-reviews-v1</code> (review records).</li>
        <li>Session state (selection, scenario results) is deliberately NOT persisted — switching workspaces never leaks state.</li>
        <li>Deleting browser storage removes your architectures — export a DEP package from the Evidence Exchange first.</li>
      </ul>
    </APanel>

    <APanel title="Panel preferences" subtitle="Studio panel visibility and sizes persist per browser">
      <ul className="text-xs text-slate-300 space-y-1">
        <li>Navigator: {state.panels.navigator ? "shown" : "hidden"} · Inspector: {state.panels.inspector ? "shown" : "hidden"} · Dock: {state.panels.dock ? "shown" : "hidden"}</li>
        <li>Default map mode: {state.panels.mode} · camera preset: {state.panels.cameraPreset} · 2D: {state.panels.is2D ? "on" : "off"}</li>
        <li>Toggle any of these from inside the Studio — changes persist automatically.</li>
      </ul>
    </APanel>
  </div>
);
