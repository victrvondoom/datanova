/**
 * Studio state hook: wraps the pure store with React state, debounced
 * persistence (flushed on unload), undo history and workspace actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Architecture, emptyArchitecture } from "./model";
import { BLUEPRINTS } from "./blueprints";
import { getScenario } from "./scenarios";
import { startChallenge as newChallenge } from "./challenge";
import {
  StoreState, StudioStorage, Workspace, deleteWorkspace, duplicateWorkspace, exportWorkspaceJson, loadStore, makeId, newWorkspace,
  parseWorkspaceImport, renameWorkspace, saveStore, upsertWorkspace,
} from "./store";

export const browserStorage: StudioStorage = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
  removeItem: (k) => window.localStorage.removeItem(k),
};

export type Template = "blank" | "baseline" | "example";
export interface SaveStatus {
  ok: boolean;
  at: string;
  error?: string;
}

const nowIso = (): string => new Date().toISOString();

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Undo history is kept in state next to the store so every state updater stays pure (safe under StrictMode). */
export const HISTORY_LIMIT = 24;
export interface StudioState {
  store: StoreState;
  history: Record<string, Architecture[]>;
}

/** Pure: apply an architecture edit to the active workspace, optionally recording undo history. */
export function applyArchEdit(st: StudioState, f: (a: Architecture) => Architecture, undoable: boolean, now: string): StudioState {
  const cur = st.store.workspaces.find((w) => w.id === st.store.activeId);
  if (!cur) return st;
  const next = f(cur.arch);
  if (next === cur.arch) return st;
  return {
    store: upsertWorkspace(st.store, { ...cur, arch: next, updatedAt: now }),
    history: undoable ? { ...st.history, [cur.id]: [...(st.history[cur.id] ?? []).slice(-(HISTORY_LIMIT - 1)), cur.arch] } : st.history,
  };
}

/** Pure: restore the previous architecture of the active workspace. */
export function applyUndo(st: StudioState, now: string): StudioState {
  const cur = st.store.workspaces.find((w) => w.id === st.store.activeId);
  const h = cur ? st.history[cur.id] : undefined;
  if (!cur || !h || h.length === 0) return st;
  return { store: upsertWorkspace(st.store, { ...cur, arch: h[h.length - 1], updatedAt: now }), history: { ...st.history, [cur.id]: h.slice(0, -1) } };
}

export function useStudio() {
  const [state, setState] = useState<StudioState>(() => ({ store: loadStore(browserStorage), history: {} }));
  const store = state.store;
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const storeRef = useRef(store);
  const dirty = useRef(false);

  const flush = useCallback(() => {
    const r = saveStore(browserStorage, storeRef.current);
    dirty.current = false;
    setStatus({ ok: r.ok, at: nowIso(), error: r.error });
    return r;
  }, []);

  useEffect(() => {
    storeRef.current = store;
    if (!dirty.current) return;
    const t = window.setTimeout(flush, 250);
    return () => window.clearTimeout(t);
  }, [store, flush]);

  useEffect(() => {
    const onHide = () => { if (dirty.current) flush(); };
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("beforeunload", onHide); window.removeEventListener("pagehide", onHide); onHide(); };
  }, [flush]);

  const mutate = useCallback((f: (s: StoreState) => StoreState) => {
    dirty.current = true;
    setState((st) => ({ ...st, store: f(st.store) }));
  }, []);

  const ws: Workspace | null = useMemo(() => store.workspaces.find((w) => w.id === store.activeId) ?? null, [store]);

  const update = useCallback((f: (w: Workspace) => Workspace) => {
    mutate((s) => {
      const cur = s.workspaces.find((w) => w.id === s.activeId);
      if (!cur) return s;
      return upsertWorkspace(s, { ...f(cur), updatedAt: nowIso() });
    });
  }, [mutate]);

  /** change the architecture, remembering the previous one for undo */
  const setArch = useCallback((f: (a: Architecture) => Architecture, opts: { undoable?: boolean } = {}) => {
    dirty.current = true;
    setState((st) => applyArchEdit(st, f, opts.undoable !== false, nowIso()));
  }, []);

  const undo = useCallback(() => {
    dirty.current = true;
    setState((st) => applyUndo(st, nowIso()));
  }, []);
  const undoDepth = ws ? state.history[ws.id]?.length ?? 0 : 0;

  const createWorkspace = useCallback((scenarioId: string, template: Template, name?: string, challenge = false): string => {
    const sc = getScenario(scenarioId);
    const arch = template === "blank" ? emptyArchitecture() : BLUEPRINTS[scenarioId]?.[template]() ?? emptyArchitecture();
    const id = makeId(Date.now());
    const label = name ?? `${sc?.name ?? "Architecture"}${challenge ? " — challenge" : template === "baseline" ? " — first draft" : template === "example" ? " — worked example" : ""}`;
    const w = newWorkspace(id, label, scenarioId, nowIso(), arch);
    if (challenge) { w.mode = "challenge"; w.challenge = newChallenge(scenarioId); }
    mutate((s) => upsertWorkspace(s, w));
    return id;
  }, [mutate]);

  const open = useCallback((id: string) => mutate((s) => (s.workspaces.some((w) => w.id === id) ? { ...s, activeId: id } : s)), [mutate]);
  const rename = useCallback((id: string, name: string) => mutate((s) => renameWorkspace(s, id, name, nowIso())), [mutate]);
  const duplicate = useCallback((id: string) => mutate((s) => duplicateWorkspace(s, id, makeId(Date.now()), nowIso())), [mutate]);
  const remove = useCallback((id: string) => mutate((s) => deleteWorkspace(s, id)), [mutate]);
  const importText = useCallback((text: string): { ok: boolean; errors: string[] } => {
    const r = parseWorkspaceImport(text, makeId(Date.now()), nowIso());
    if (!r.ok || !r.value) return { ok: false, errors: r.errors };
    const w = r.value;
    mutate((s) => upsertWorkspace(s, w));
    return { ok: true, errors: [] };
  }, [mutate]);
  const exportJson = useCallback((w: Workspace) => exportWorkspaceJson(w, nowIso()), []);

  return { store, ws, status, update, setArch, undo, undoDepth, createWorkspace, open, rename, duplicate, remove, importText, exportJson, saveNow: flush };
}

export type StudioApi = ReturnType<typeof useStudio>;
