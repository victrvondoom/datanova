import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, StudioState, applyArchEdit, applyUndo } from "../useStudio";
import { addNode, moveNode } from "../model";
import { emptyStore, newWorkspace, upsertWorkspace } from "../store";
import { emptyArchitecture } from "../model";

const start = (): StudioState => ({ store: upsertWorkspace(emptyStore(), newWorkspace("w", "t", "pdf-saas", "t0", emptyArchitecture())), history: {} });

describe("studio state transitions are pure (safe under StrictMode double-invocation)", () => {
  it("applying the same updater twice from the same state gives identical results (no hidden side effects)", () => {
    const s0 = start();
    const a = applyArchEdit(s0, (x) => addNode(x, "client"), true, "t1");
    const b = applyArchEdit(s0, (x) => addNode(x, "client"), true, "t1");
    expect(a).toEqual(b);
    expect(s0.history).toEqual({}); // input untouched
  });

  it("one edit pushes exactly one undo entry and one undo reverts exactly one edit", () => {
    let s = start();
    s = applyArchEdit(s, (x) => addNode(x, "client"), true, "t1");
    s = applyArchEdit(s, (x) => addNode(x, "app_service"), true, "t2");
    expect(s.history.w).toHaveLength(2);
    s = applyUndo(s, "t3");
    expect(s.store.workspaces[0].arch.nodes).toHaveLength(1);
    s = applyUndo(s, "t4");
    expect(s.store.workspaces[0].arch.nodes).toHaveLength(0);
    expect(applyUndo(s, "t5")).toBe(s); // nothing left to undo
  });

  it("non-undoable edits (moves, typing) do not pollute history; no-op edits change nothing", () => {
    let s = applyArchEdit(start(), (x) => addNode(x, "client"), true, "t1");
    s = applyArchEdit(s, (x) => moveNode(x, x.nodes[0].id, 400, 300), false, "t2");
    expect(s.history.w).toHaveLength(1);
    expect(applyArchEdit(s, (x) => x, true, "t3")).toBe(s);
  });

  it("history is bounded", () => {
    let s = start();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) s = applyArchEdit(s, (x) => addNode(x, "client"), true, `t${i}`);
    expect(s.history.w).toHaveLength(HISTORY_LIMIT);
  });
});
