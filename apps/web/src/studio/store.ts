/**
 * Studio persistence (localStorage behind an injectable interface — a local
 * learning app; no backend). Includes strict validation of imported data.
 */
import {
  Architecture, ArchNode, ConnType, Connection, KIND_DEFS, KIND_LIST, Props, PropValue, canConnect, defaultProps, emptyArchitecture, isKind,
} from "./model";
import { Adr, ADR_STATUSES, AdrStatus, normalizeDraft } from "./adr";
import { CapacityInputs, DEFAULT_CAPACITY, sanitize } from "./capacity";
import { ChallengeState } from "./challenge";
import { FailureId, FAILURES } from "./failures";
import { ReviewResult } from "./review";
import { getScenario } from "./scenarios";

export interface StudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORE_KEY = "tracen-studio-v1";
export const EXPORT_FORMAT = "tracen-studio-workspace";
export const MAX_IMPORT_BYTES = 2_000_000;
export const MAX_NODES = 200;
export const MAX_CONNECTIONS = 500;

export interface NamedVersion {
  id: string;
  name: string;
  savedAt: string;
  arch: Architecture;
}

export interface RequirementMark {
  status: "addressed" | "concern";
  note: string;
}

export interface FailureConfig {
  failureId: FailureId;
  targetId: string;
  latencyMs: number;
  multiplier: number;
  copies: number;
}

export interface Workspace {
  id: string;
  name: string;
  scenarioId: string;
  mode: "free" | "challenge";
  createdAt: string;
  updatedAt: string;
  arch: Architecture;
  versions: NamedVersion[];
  compare: { a: string; b: string };
  adrs: Adr[];
  marks: Record<string, RequirementMark>;
  capacity: CapacityInputs;
  failureConfig: FailureConfig;
  challenge: ChallengeState | null;
  review: ReviewResult | null;
}

export interface StoreState {
  version: 1;
  activeId: string | null;
  workspaces: Workspace[];
}

export const emptyStore = (): StoreState => ({ version: 1, activeId: null, workspaces: [] });

export const defaultFailureConfig = (): FailureConfig => ({ failureId: "api-503", targetId: "", latencyMs: 4000, multiplier: 5, copies: 2 });

export function newWorkspace(id: string, name: string, scenarioId: string, now: string, arch: Architecture = emptyArchitecture()): Workspace {
  const sc = getScenario(scenarioId);
  return {
    id, name: name.slice(0, 80) || "Untitled architecture", scenarioId, mode: "free", createdAt: now, updatedAt: now, arch,
    versions: [], compare: { a: "", b: "current" }, adrs: [], marks: {}, capacity: { ...(sc?.capacity ?? DEFAULT_CAPACITY) },
    failureConfig: defaultFailureConfig(), challenge: null, review: null,
  };
}

// ------------------------------------------------------------- validation

export interface Validated<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const CONN_TYPES: ConnType[] = ["sync", "async", "event", "data", "schedule"];

export function validateArchitectureShape(x: unknown): Validated<Architecture> {
  const errors: string[] = [];
  if (!isObj(x)) return { ok: false, errors: ["Architecture must be an object."] };
  if (!Array.isArray(x.nodes) || !Array.isArray(x.connections)) return { ok: false, errors: ["Architecture needs ‘nodes’ and ‘connections’ arrays."] };
  if (x.nodes.length > MAX_NODES) errors.push(`Too many components (max ${MAX_NODES}).`);
  if (x.connections.length > MAX_CONNECTIONS) errors.push(`Too many connections (max ${MAX_CONNECTIONS}).`);
  if (errors.length) return { ok: false, errors };
  const nodes: ArchNode[] = [];
  const ids = new Set<string>();
  x.nodes.forEach((raw, i) => {
    if (!isObj(raw)) { errors.push(`Component ${i + 1} is not an object.`); return; }
    const id = raw.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) { errors.push(`Component ${i + 1} has an invalid id.`); return; }
    if (ids.has(id)) { errors.push(`Duplicate component id ‘${id}’.`); return; }
    if (!isKind(raw.kind)) { errors.push(`Component ‘${id}’ has unknown kind ‘${String(raw.kind)}’.`); return; }
    if (!finite(raw.x) || !finite(raw.y)) { errors.push(`Component ‘${id}’ has invalid coordinates.`); return; }
    const kind = raw.kind;
    const props: Props = defaultProps(kind);
    if (raw.props !== undefined) {
      if (!isObj(raw.props)) { errors.push(`Component ‘${id}’ props must be an object.`); return; }
      for (const [k, v] of Object.entries(raw.props)) {
        const def = KIND_DEFS[kind].props.find((p) => p.key === k);
        if (!def) continue; // unknown keys are dropped, never trusted
        if (def.type === "number") { if (!finite(v)) { errors.push(`‘${id}.${k}’ must be a finite number.`); continue; } props[k] = Math.max(def.min ?? 0, v); }
        else if (def.type === "boolean") { if (typeof v !== "boolean") { errors.push(`‘${id}.${k}’ must be true/false.`); continue; } props[k] = v; }
        else if (def.type === "select") { if (typeof v !== "string" || !def.options?.includes(v)) { errors.push(`‘${id}.${k}’ has an invalid option.`); continue; } props[k] = v; }
        else { if (typeof v !== "string") { errors.push(`‘${id}.${k}’ must be text.`); continue; } props[k] = v.slice(0, 200); }
      }
    }
    ids.add(id);
    nodes.push({ id, kind, name: typeof raw.name === "string" ? raw.name.slice(0, 60) : KIND_DEFS[kind].label, x: Math.max(0, Math.min(4000, Math.round(raw.x))), y: Math.max(0, Math.min(4000, Math.round(raw.y))), group: typeof raw.group === "string" ? raw.group.slice(0, 40) : "", props });
  });
  // policy targets must reference existing nodes
  for (const n of nodes) if (KIND_DEFS[n.kind].policy && n.props.target && !ids.has(String(n.props.target))) n.props.target = "";
  let arch: Architecture = { version: 1, seq: 0, nodes, connections: [] };
  const connIds = new Set<string>();
  const conns: Connection[] = [];
  x.connections.forEach((raw, i) => {
    if (!isObj(raw)) { errors.push(`Connection ${i + 1} is not an object.`); return; }
    const { id, from, to, type, label } = raw;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(id) || connIds.has(id)) { errors.push(`Connection ${i + 1} has a missing or duplicate id.`); return; }
    if (typeof from !== "string" || typeof to !== "string" || !ids.has(from) || !ids.has(to)) { errors.push(`Connection ‘${id}’ points at a component that does not exist.`); return; }
    if (typeof type !== "string" || !CONN_TYPES.includes(type as ConnType)) { errors.push(`Connection ‘${id}’ has unknown type.`); return; }
    const chk = canConnect(arch, from, to, type as ConnType);
    if (!chk.ok) { errors.push(`Connection ‘${id}’ is invalid: ${chk.reason}`); return; }
    connIds.add(id);
    const c: Connection = { id, from, to, type: type as ConnType, label: typeof label === "string" ? label.slice(0, 60) : "" };
    conns.push(c);
    arch = { ...arch, connections: conns.slice() };
  });
  if (errors.length) return { ok: false, errors };
  const maxSuffix = [...ids, ...connIds].reduce((m, s) => Math.max(m, parseInt(s.replace(/\D/g, ""), 10) || 0), 0);
  return { ok: true, errors: [], value: { version: 1, seq: Math.max(maxSuffix, typeof x.seq === "number" && finite(x.seq) ? x.seq : 0), nodes, connections: conns } };
}

function sanitizeAdrs(x: unknown, errors: string[]): Adr[] {
  if (x === undefined) return [];
  if (!Array.isArray(x)) { errors.push("ADRs must be a list."); return []; }
  const out: Adr[] = [];
  x.forEach((raw, i) => {
    if (!isObj(raw) || typeof raw.title !== "string" || typeof raw.decision !== "string" || typeof raw.reason !== "string") { errors.push(`ADR ${i + 1} is malformed.`); return; }
    const status = ADR_STATUSES.includes(raw.status as AdrStatus) ? (raw.status as AdrStatus) : "Proposed";
    const draft = normalizeDraft({
      title: raw.title, status, context: String(raw.context ?? ""), decision: raw.decision, alternatives: String(raw.alternatives ?? ""), reason: raw.reason,
      tradeoffs: String(raw.tradeoffs ?? ""), risks: String(raw.risks ?? ""), followUp: String(raw.followUp ?? ""),
      relatedRequirementIds: Array.isArray(raw.relatedRequirementIds) ? raw.relatedRequirementIds.map(String) : [],
      relatedTopicIds: Array.isArray(raw.relatedTopicIds) ? raw.relatedTopicIds.filter((n): n is number => typeof n === "number") : [],
      relatedNodeIds: Array.isArray(raw.relatedNodeIds) ? raw.relatedNodeIds.map(String) : [],
    });
    const number = i + 1;
    out.push({ ...draft, id: `ADR-${String(number).padStart(3, "0")}`, number, createdAt: String(raw.createdAt ?? ""), updatedAt: String(raw.updatedAt ?? "") });
  });
  return out;
}

export interface WorkspaceExport {
  format: typeof EXPORT_FORMAT;
  formatVersion: 1;
  exportedAt: string;
  workspace: Workspace;
}

export const exportWorkspaceJson = (ws: Workspace, now: string): string =>
  JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, exportedAt: now, workspace: ws } satisfies WorkspaceExport, null, 2);

/** Validate imported JSON before it can touch application state. */
export function parseWorkspaceImport(text: string, newId: string, now: string): Validated<Workspace> {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ["File is too large to import."] };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, errors: ["Not valid JSON."] }; }
  if (!isObj(data) || data.format !== EXPORT_FORMAT) return { ok: false, errors: ["Not a TRACEN Architecture Studio export (wrong or missing ‘format’)."] };
  if (data.formatVersion !== 1) return { ok: false, errors: [`Unsupported formatVersion ${String(data.formatVersion)}.`] };
  const w = data.workspace;
  if (!isObj(w)) return { ok: false, errors: ["Missing ‘workspace’ object."] };
  if (typeof w.scenarioId !== "string" || !getScenario(w.scenarioId)) return { ok: false, errors: [`Unknown scenario ‘${String(w.scenarioId)}’.`] };
  const archV = validateArchitectureShape(w.arch);
  if (!archV.ok || !archV.value) return { ok: false, errors: archV.errors };
  const errors: string[] = [];
  const adrs = sanitizeAdrs(w.adrs, errors);
  const versions: NamedVersion[] = [];
  if (Array.isArray(w.versions)) {
    for (const v of w.versions.slice(0, 20)) {
      if (!isObj(v)) continue;
      const av = validateArchitectureShape(v.arch);
      if (!av.ok || !av.value) { errors.push(`Saved version ‘${String(v.name)}’ is invalid: ${av.errors[0]}`); continue; }
      versions.push({ id: String(v.id ?? `v${versions.length + 1}`).slice(0, 40), name: String(v.name ?? "Version").slice(0, 60), savedAt: String(v.savedAt ?? ""), arch: av.value });
    }
  }
  if (errors.length) return { ok: false, errors };
  const marks: Record<string, RequirementMark> = {};
  if (isObj(w.marks)) for (const [k, v] of Object.entries(w.marks)) if (isObj(v) && (v.status === "addressed" || v.status === "concern")) marks[k.slice(0, 40)] = { status: v.status, note: String(v.note ?? "").slice(0, 1000) };
  const base = newWorkspace(newId, typeof w.name === "string" ? w.name : "Imported architecture", w.scenarioId, now, archV.value);
  const fc = isObj(w.failureConfig) ? w.failureConfig : {};
  const ws: Workspace = {
    ...base, createdAt: typeof w.createdAt === "string" ? w.createdAt : now, adrs, versions, marks,
    capacity: isObj(w.capacity) ? sanitize({ ...DEFAULT_CAPACITY, ...(w.capacity as Partial<CapacityInputs>) }) : base.capacity,
    failureConfig: {
      failureId: FAILURES.some((f) => f.id === fc.failureId) ? (fc.failureId as FailureId) : "api-503", targetId: typeof fc.targetId === "string" ? fc.targetId : "",
      latencyMs: finite(fc.latencyMs) ? fc.latencyMs : 4000, multiplier: finite(fc.multiplier) ? fc.multiplier : 5, copies: finite(fc.copies) ? fc.copies : 2,
    },
    // challenge progress and review results are recomputed locally, never trusted from a file
    challenge: null, review: null, mode: "free",
  };
  return { ok: true, errors: [], value: ws };
}

// ------------------------------------------------------------- store ops

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function loadStore(storage: StudioStorage): StoreState {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw) as StoreState;
    if (!isObj(p) || !Array.isArray(p.workspaces)) return emptyStore();
    const workspaces: Workspace[] = [];
    for (const w of p.workspaces) {
      if (!isObj(w) || typeof w.id !== "string" || typeof w.scenarioId !== "string" || !getScenario(w.scenarioId)) continue;
      const a = validateArchitectureShape(w.arch);
      if (!a.ok || !a.value) continue;
      const base = newWorkspace(w.id, String(w.name ?? ""), w.scenarioId, String(w.createdAt ?? ""), a.value);
      workspaces.push({ ...base, ...(w as unknown as Workspace), arch: a.value, capacity: sanitize({ ...DEFAULT_CAPACITY, ...(w.capacity as object) } as CapacityInputs) });
    }
    const activeId = typeof p.activeId === "string" && workspaces.some((w) => w.id === p.activeId) ? p.activeId : workspaces[0]?.id ?? null;
    return { version: 1, activeId, workspaces };
  } catch {
    return emptyStore();
  }
}

export function saveStore(storage: StudioStorage, s: StoreState): SaveResult {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(s));
    // read back: a "saved" message is only shown when the data is really there
    return storage.getItem(STORE_KEY) ? { ok: true } : { ok: false, error: "Storage accepted the write but returned nothing." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not write to local storage (it may be full or blocked)." };
  }
}

let counter = 0;
export const makeId = (now: number): string => `ws-${now.toString(36)}-${(counter++).toString(36)}`;

export const upsertWorkspace = (s: StoreState, ws: Workspace): StoreState => ({
  ...s,
  activeId: ws.id,
  workspaces: s.workspaces.some((w) => w.id === ws.id) ? s.workspaces.map((w) => (w.id === ws.id ? ws : w)) : [...s.workspaces, ws],
});

export const renameWorkspace = (s: StoreState, id: string, name: string, now: string): StoreState => ({
  ...s, workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: name.trim().slice(0, 80) || w.name, updatedAt: now } : w)),
});

export function duplicateWorkspace(s: StoreState, id: string, newId: string, now: string): StoreState {
  const src = s.workspaces.find((w) => w.id === id);
  if (!src) return s;
  const copy: Workspace = JSON.parse(JSON.stringify(src));
  copy.id = newId; copy.name = `${src.name} (copy)`.slice(0, 80); copy.createdAt = now; copy.updatedAt = now; copy.challenge = null; copy.mode = "free";
  return { ...s, activeId: newId, workspaces: [...s.workspaces, copy] };
}

export function deleteWorkspace(s: StoreState, id: string): StoreState {
  const workspaces = s.workspaces.filter((w) => w.id !== id);
  return { ...s, workspaces, activeId: s.activeId === id ? workspaces[0]?.id ?? null : s.activeId };
}

export const KIND_COUNT = KIND_LIST.length;
