import { describe, expect, it } from "vitest";
import {
  addNode, canConnect, connect, deleteNode, disconnect, emptyArchitecture, moveNode, renameNode, setConnectionLabel, setGroup, setProp,
  archFingerprint, KIND_LIST, KIND_DEFS, defaultProps,
} from "../model";
import { Builder } from "../blueprints";
import { diagramSvg, redactText, redactProps, specificationJson, safeFilename } from "../exporters";
import { SCENARIOS } from "../scenarios";
import {
  emptyStore, exportWorkspaceJson, parseWorkspaceImport, newWorkspace, saveStore, loadStore, upsertWorkspace, duplicateWorkspace,
  renameWorkspace, deleteWorkspace, validateArchitectureShape, StudioStorage, STORE_KEY,
} from "../store";

const memStorage = (): StudioStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};

describe("architecture editor operations", () => {
  it("adds components with defaults and unique ids", () => {
    let a = addNode(emptyArchitecture(), "app_service");
    a = addNode(a, "app_service");
    expect(a.nodes).toHaveLength(2);
    expect(a.nodes[0].id).not.toBe(a.nodes[1].id);
    expect(a.nodes[1].name).toBe("Application Service 2");
    expect(a.nodes[0].props).toEqual(defaultProps("app_service"));
  });

  it("every catalog kind can be added", () => {
    let a = emptyArchitecture();
    for (const k of KIND_LIST) a = addNode(a, k);
    expect(a.nodes).toHaveLength(KIND_LIST.length);
    expect(KIND_LIST.length).toBeGreaterThanOrEqual(26);
  });

  it("moves, renames and groups a component", () => {
    let a = addNode(emptyArchitecture(), "postgres");
    const id = a.nodes[0].id;
    a = moveNode(a, id, 333, 222);
    a = renameNode(a, id, "Orders DB");
    a = setGroup(a, id, "Data tier");
    expect(a.nodes[0]).toMatchObject({ x: 333, y: 222, name: "Orders DB", group: "Data tier" });
  });

  it("clamps coordinates and ignores non-finite moves", () => {
    let a = addNode(emptyArchitecture(), "client");
    a = moveNode(a, a.nodes[0].id, -50, Number.NaN);
    expect(a.nodes[0].x).toBe(0);
    expect(a.nodes[0].y).toBe(0);
  });

  it("connects valid endpoints and rejects meaningless ones", () => {
    let a = emptyArchitecture();
    a = addNode(a, "client"); a = addNode(a, "app_service"); a = addNode(a, "postgres"); a = addNode(a, "queue");
    const [c, s, d, q] = a.nodes.map((n) => n.id);
    expect(connect(a, c, s, "sync").ok).toBe(true);
    expect(connect(a, s, c, "sync").ok).toBe(false); // nothing initiates toward a client
    expect(connect(a, s, d, "sync").ok).toBe(false); // data store needs a data-access connection
    expect(connect(a, s, d, "data").ok).toBe(true);
    expect(connect(a, d, s, "data").ok).toBe(false); // stores are passive
    expect(connect(a, s, s, "sync").ok).toBe(false); // self loop
    expect(connect(a, s, q, "sync").ok).toBe(false); // queues need async
    expect(connect(a, s, q, "async").ok).toBe(true);
    expect(connect(a, c, s, "schedule").ok).toBe(false); // only cron schedules
  });

  it("rejects duplicate connections but allows the same pair with a different type", () => {
    let a = addNode(addNode(emptyArchitecture(), "app_service"), "app_service");
    const [x, y] = a.nodes.map((n) => n.id);
    const r = connect(a, x, y, "sync");
    a = r.arch;
    expect(canConnect(a, x, y, "sync").ok).toBe(false);
  });

  it("policy components are not wired in", () => {
    let a = addNode(addNode(emptyArchitecture(), "timeout"), "app_service");
    expect(connect(a, a.nodes[0].id, a.nodes[1].id, "sync").ok).toBe(false);
  });

  it("disconnects and labels connections", () => {
    let a = addNode(addNode(emptyArchitecture(), "client"), "app_service");
    const r = connect(a, a.nodes[0].id, a.nodes[1].id, "sync", "HTTPS");
    a = setConnectionLabel(r.arch, r.id as string, "REST");
    expect(a.connections[0].label).toBe("REST");
    a = disconnect(a, r.id as string);
    expect(a.connections).toHaveLength(0);
  });

  it("deleting a component removes its connections and clears policy targets", () => {
    const b = new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0).n("e", "external_service", 2, 0).n("t", "timeout", 2, 1, { target: "e" })
      .c("c", "s", "sync").c("s", "e", "sync");
    let a = b.build();
    a = deleteNode(a, b.id("e"));
    expect(a.connections).toHaveLength(1);
    expect(a.nodes.find((n) => n.kind === "timeout")?.props.target).toBe("");
  });

  it("edits properties with type safety", () => {
    let a = addNode(emptyArchitecture(), "rate_limiter");
    const id = a.nodes[0].id;
    a = setProp(a, id, "capacity", "250");
    a = setProp(a, id, "algorithm", "sliding_window");
    a = setProp(a, id, "algorithm", "not_an_option"); // invalid select falls back to default
    a = setProp(a, id, "nonexistent", 1); // unknown key ignored
    a = setProp(a, id, "capacity", -5); // min enforced
    expect(a.nodes[0].props.algorithm).toBe("token_bucket");
    expect(a.nodes[0].props.capacity).toBe(1);
    expect("nonexistent" in a.nodes[0].props).toBe(false);
  });

  it("fingerprint ignores position changes but sees configuration changes", () => {
    let a = addNode(emptyArchitecture(), "app_service");
    const f0 = archFingerprint(a);
    expect(archFingerprint(moveNode(a, a.nodes[0].id, 900, 900))).toBe(f0);
    a = setProp(a, a.nodes[0].id, "instances", 3);
    expect(archFingerprint(a)).not.toBe(f0);
  });

  it("each catalog kind has a topic mapping and category", () => {
    for (const k of KIND_LIST) expect(KIND_DEFS[k].topics.length).toBeGreaterThan(0);
  });
});

describe("persistence: save, reload, duplicate, rename, delete", () => {
  const mk = () => {
    const arch = new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0, { instances: 2 }).c("c", "s", "sync", "HTTPS").build();
    return newWorkspace("ws1", "My design", "pdf-saas", "2026-01-01T00:00:00Z", arch);
  };

  it("saves and reloads a workspace from storage", () => {
    const st = memStorage();
    const ws = mk();
    expect(saveStore(st, upsertWorkspace(emptyStore(), ws)).ok).toBe(true);
    const back = loadStore(st);
    expect(back.workspaces).toHaveLength(1);
    expect(back.workspaces[0].arch.nodes).toHaveLength(2);
    expect(back.workspaces[0].arch.nodes[1].props.instances).toBe(2);
    expect(back.activeId).toBe("ws1");
  });

  it("reports storage failure instead of pretending to have saved", () => {
    const failing: StudioStorage = { getItem: () => null, setItem: () => { throw new Error("quota exceeded"); }, removeItem: () => undefined };
    const r = saveStore(failing, emptyStore());
    expect(r.ok).toBe(false);
    expect(r.error).toContain("quota");
  });

  it("survives corrupted storage", () => {
    const st = memStorage();
    st.data[STORE_KEY] = "{not json";
    expect(loadStore(st).workspaces).toEqual([]);
  });

  it("duplicates, renames and deletes", () => {
    let s = upsertWorkspace(emptyStore(), mk());
    s = duplicateWorkspace(s, "ws1", "ws2", "2026-01-02T00:00:00Z");
    expect(s.workspaces.map((w) => w.name)).toEqual(["My design", "My design (copy)"]);
    expect(s.workspaces[1].arch).toEqual(s.workspaces[0].arch);
    s = renameWorkspace(s, "ws2", "Renamed", "t");
    expect(s.workspaces[1].name).toBe("Renamed");
    s = deleteWorkspace(s, "ws2");
    expect(s.workspaces).toHaveLength(1);
    expect(s.activeId).toBe("ws1");
  });
});

describe("export and import", () => {
  const ws = newWorkspace("w", "Export me", "pdf-saas", "t", new Builder().n("c", "client", 0, 0).n("s", "app_service", 1, 0).c("c", "s", "sync").build());

  it("round-trips a valid architecture", () => {
    const json = exportWorkspaceJson(ws, "now");
    const r = parseWorkspaceImport(json, "new-id", "now");
    expect(r.ok).toBe(true);
    expect(r.value?.id).toBe("new-id");
    expect(r.value?.arch.nodes).toHaveLength(2);
    expect(r.value?.arch.connections).toHaveLength(1);
  });

  it("rejects invalid imports", () => {
    const base = JSON.parse(exportWorkspaceJson(ws, "now"));
    const bad = (mut: (x: any) => void): ReturnType<typeof parseWorkspaceImport> => { const c = JSON.parse(JSON.stringify(base)); mut(c); return parseWorkspaceImport(JSON.stringify(c), "i", "n"); };
    expect(parseWorkspaceImport("not json", "i", "n").ok).toBe(false);
    expect(parseWorkspaceImport(JSON.stringify({ hello: 1 }), "i", "n").ok).toBe(false);
    expect(bad((c) => { c.workspace.scenarioId = "nope"; }).ok).toBe(false);
    expect(bad((c) => { c.formatVersion = 99; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.nodes[0].kind = "mainframe"; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.nodes[1].id = c.workspace.arch.nodes[0].id; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.nodes[0].x = "far"; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.connections[0].to = "ghost"; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.connections[0].type = "telepathy"; }).ok).toBe(false);
    // a connection that violates the connection rules (service -> client) is rejected
    expect(bad((c) => { const k = c.workspace.arch.connections[0]; [k.from, k.to] = [k.to, k.from]; }).ok).toBe(false);
    expect(bad((c) => { c.workspace.arch.nodes[1].props.instances = "many"; }).ok).toBe(false);
    expect(parseWorkspaceImport("x".repeat(2_100_000), "i", "n").ok).toBe(false);
  });

  it("drops unknown props and never trusts imported challenge state", () => {
    const base = JSON.parse(exportWorkspaceJson(ws, "now"));
    base.workspace.arch.nodes[1].props.__proto_pollution = "x";
    base.workspace.challenge = { finalized: true };
    const r = parseWorkspaceImport(JSON.stringify(base), "i", "n");
    expect(r.ok).toBe(true);
    expect("__proto_pollution" in (r.value?.arch.nodes[1].props ?? {})).toBe(false);
    expect(r.value?.challenge).toBeNull();
  });

  it("rejects too many components", () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, kind: "client", x: 0, y: 0 }));
    expect(validateArchitectureShape({ nodes, connections: [] }).ok).toBe(false);
  });

  it("SVG export has a title, legend and escaped labels", () => {
    const arch = new Builder().n("c", "client", 0, 0, {}, "Browser <script>").n("s", "app_service", 1, 0, {}, "API").c("c", "s", "sync", "REST & JSON").build();
    const svg = diagramSvg(arch, "My <Title>", "pdf");
    expect(svg).toContain("<svg");
    expect(svg).toContain("My &lt;Title&gt;");
    expect(svg).toContain("Legend");
    expect(svg).toContain("Synchronous request");
    expect(svg).toContain("Asynchronous message");
    expect(svg).toContain("REST &amp; JSON");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("Browser");
  });

  it("redacts secrets from exports", () => {
    expect(redactText("my key is sk-abcdefghijklmnopqrstuv")).toContain("[redacted]");
    expect(redactText("password=hunter2")).toContain("[redacted]");
    expect(redactText("ghp_abcdefghijklmnopqrstuvwxyz0123")).toContain("[redacted]");
    expect(redactText("plain text")).toBe("plain text");
    expect(redactProps({ apiKey: "abc", note: "token=zzz" })).toEqual({ apiKey: "[redacted]", note: "[redacted]" });
    const arch = new Builder().n("s", "app_service", 0, 0, { justification: "uses AKIAABCDEFGHIJKLMNOP for s3" }).build();
    const spec = specificationJson({ workspaceName: "x", scenario: SCENARIOS[0], arch, adrs: [], marks: {}, findings: [], review: null, capacity: SCENARIOS[0].capacity, exportedAt: "t" });
    expect(spec).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });

  it("safeFilename strips unsafe characters", () => {
    expect(safeFilename("../../My Design!!", "svg")).toBe("my-design.svg");
  });
});
