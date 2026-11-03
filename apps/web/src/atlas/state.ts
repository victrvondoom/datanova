/**
 * Datanova Atlas — workspace state (Campaign 06, Tasks 06, 07, 12).
 *
 * Project lifecycle (create/rename/duplicate/archive/select), unsaved
 * tracking, panel/camera preferences, and per-project isolation: switching
 * projects clears selection, scenario results, and map state so nothing
 * leaks between projects. Persistence via localStorage behind an injectable
 * storage (same pattern as the lab/trail stores).
 */

import { docflowModel, flawedCheckoutModel } from "../lab/samples";
import { parseModel, serializeModel, type ArchitectureModel } from "../lab/model";
import type { MapMode } from "./layers";

export interface Project {
  id: string;
  name: string;
  description: string;
  /** serialized canonical model — the single source of truth */
  modelJson: string;
  builtin: "arch-docflow" | "arch-flawed-checkout" | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  /** version counter — bumped on each save */
  version: number;
}

export interface PanelPrefs {
  navigator: boolean;
  inspector: boolean;
  dock: boolean;
  minimap: boolean;
  navigatorWidth: number;
  inspectorWidth: number;
  dockHeight: number;
  is2D: boolean;
  mode: MapMode;
  cameraPreset: "iso" | "top" | "side" | "front";
}

export interface AtlasState {
  projects: Project[];
  activeProjectId: string;
  unsaved: Record<string, boolean>;
  panels: PanelPrefs;
  /** transient per-project session state (not persisted) */
  session: {
    selected: { id: string; kind: "node" | "edge" } | null;
    lastScenario: { project: string; saturated: boolean; peakRps: number; summary: string } | null;
  };
}

export const DEFAULT_PANELS: PanelPrefs = {
  navigator: true,
  inspector: true,
  dock: true,
  minimap: true,
  navigatorWidth: 250,
  inspectorWidth: 300,
  dockHeight: 200,
  is2D: false,
  mode: "topology",
  cameraPreset: "iso",
};

const STORAGE_KEY = "datanova-atlas-v1";

export interface AtlasStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultAtlasState(): AtlasState {
  const now = new Date(0).toISOString(); // deterministic default timestamp; real creates use caller time
  const docflow: Project = {
    id: "proj-docflow",
    name: "DocFlow (reference)",
    description: "Document-processing SaaS reference architecture",
    modelJson: serializeModel(docflowModel()),
    builtin: "arch-docflow",
    archived: false,
    createdAt: now, updatedAt: now, version: 1,
  };
  const flawed: Project = {
    id: "proj-flawed",
    name: "Flawed checkout (fixture)",
    description: "Deliberately flawed benchmark fixture",
    modelJson: serializeModel(flawedCheckoutModel()),
    builtin: "arch-flawed-checkout",
    archived: false,
    createdAt: now, updatedAt: now, version: 1,
  };
  return {
    projects: [docflow, flawed],
    activeProjectId: docflow.id,
    unsaved: {},
    panels: DEFAULT_PANELS,
    session: { selected: null, lastScenario: null },
  };
}

export function loadAtlasState(storage: AtlasStorage): AtlasState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultAtlasState();
    const parsed = JSON.parse(raw) as Partial<AtlasState>;
    const base = defaultAtlasState();
    const projects = (parsed.projects ?? []).map((p) => {
      parseModel(p.modelJson); // stored models must still validate
      return p;
    });
    return {
      projects: projects.length > 0 ? projects : base.projects,
      activeProjectId: projects.some((p) => p.id === parsed.activeProjectId) ? parsed.activeProjectId! : base.activeProjectId,
      unsaved: parsed.unsaved ?? {},
      panels: { ...base.panels, ...(parsed.panels ?? {}) },
      // session state is NEVER persisted — no cross-project leakage
      session: { selected: null, lastScenario: null },
    };
  } catch {
    return defaultAtlasState();
  }
}

export function saveAtlasState(storage: AtlasStorage, state: AtlasState): void {
  const { session: _session, ...persist } = state;
  storage.setItem(STORAGE_KEY, JSON.stringify(persist));
}

/** Project lifecycle operations — all pure. */
export function createProject(state: AtlasState, name: string, description: string, model: ArchitectureModel, now: string): AtlasState {
  const id = `proj-${now.replace(/[^0-9]/g, "")}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}`;
  const project: Project = {
    id, name: name || "Untitled architecture", description,
    modelJson: serializeModel(model), builtin: null, archived: false,
    createdAt: now, updatedAt: now, version: 1,
  };
  return { ...state, projects: [...state.projects, project], activeProjectId: id, session: { selected: null, lastScenario: null } };
}

export function duplicateProject(state: AtlasState, id: string, now: string): AtlasState {
  const src = state.projects.find((p) => p.id === id);
  if (!src) return state;
  return createProject(state, `${src.name} (copy)`, src.description, parseModel(src.modelJson), now);
}

export function renameProject(state: AtlasState, id: string, name: string): AtlasState {
  return { ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, name } : p)) };
}

export function archiveProject(state: AtlasState, id: string): AtlasState {
  return { ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)) };
}

export function selectProject(state: AtlasState, id: string): AtlasState {
  if (!state.projects.some((p) => p.id === id)) return state;
  // Project switching RESETS the session: no selection/scenario leakage (Task 06.5).
  return { ...state, activeProjectId: id, session: { selected: null, lastScenario: null } };
}

/** Save a model change: bumps version, clears unsaved, keeps the selection. */
export function saveModel(state: AtlasState, modelJson: string, now: string): AtlasState {
  parseModel(modelJson); // must validate before saving
  const id = state.activeProjectId;
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === id ? { ...p, modelJson, version: p.version + 1, updatedAt: now } : p)),
    unsaved: { ...state.unsaved, [id]: false },
  };
}

export function markUnsaved(state: AtlasState, modelJson: string): AtlasState {
  const id = state.activeProjectId;
  const current = state.projects.find((p) => p.id === id);
  if (current && current.modelJson === modelJson) return state;
  return { ...state, unsaved: { ...state.unsaved, [id]: true } };
}

export function activeProject(state: AtlasState): Project {
  return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
}
