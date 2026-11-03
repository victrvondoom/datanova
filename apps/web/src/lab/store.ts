/**
 * Lab persistence: the current architecture + learning mode in localStorage
 * behind an injectable storage interface (same pattern as the trail's
 * progress.ts — no backend, no new dependencies).
 */

import { type ArchitectureModel, parseModel, serializeModel } from "./model";
import { docflowModel, flawedCheckoutModel } from "./samples";

export type LearningMode = "beginner" | "intermediate" | "expert";

export interface LabState {
  /** which built-in architecture the lab currently shows/edits */
  archId: string;
  /** serialized canonical model (the single source of truth for the UI) */
  modelJson: string;
  mode: LearningMode;
}

export interface LabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "tracen-lab-state-v1";

export const BUILTIN_ARCHETYPES: { id: string; label: string; build: () => ArchitectureModel }[] = [
  { id: "arch-docflow", label: "DocFlow (reference)", build: docflowModel },
  { id: "arch-flawed-checkout", label: "Flawed checkout (fixture)", build: flawedCheckoutModel },
];

export const defaultLabState = (): LabState => ({
  archId: "arch-docflow",
  modelJson: serializeModel(docflowModel()),
  mode: "intermediate",
});

export function loadLabState(storage: LabStorage): LabState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return defaultLabState();
  try {
    const parsed = JSON.parse(raw) as Partial<LabState>;
    // the stored model must still validate: corrupted data falls back loudly
    parseModel(parsed.modelJson ?? "");
    return {
      archId: typeof parsed.archId === "string" ? parsed.archId : "arch-docflow",
      modelJson: parsed.modelJson ?? defaultLabState().modelJson,
      mode: parsed.mode === "beginner" || parsed.mode === "expert" ? parsed.mode : "intermediate",
    };
  } catch {
    return defaultLabState();
  }
}

export function saveLabState(storage: LabStorage, state: LabState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetLabState(storage: LabStorage): LabState {
  storage.removeItem(STORAGE_KEY);
  return defaultLabState();
}
