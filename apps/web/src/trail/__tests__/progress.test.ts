/**
 * Progress-persistence tests with an injected storage mock (no DOM).
 * Verifies the full user flow: visit ≠ complete, simulation + quiz =
 * complete, persistence across reloads, and reset.
 */
import { describe, expect, it } from "vitest";
import {
  completeTopic,
  emptyProgress,
  isTopicComplete,
  loadProgress,
  markVisited,
  overallProgress,
  recordQuizAnswer,
  resetProgress,
  saveProgress,
} from "../progress";

function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _dump: () => map,
  };
}

describe("progress persistence", () => {
  it("starts empty for a fresh visitor", () => {
    const st = memStorage();
    const p = loadProgress(st);
    expect(p).toEqual(emptyProgress());
  });

  it("recovers corrupted storage gracefully", () => {
    const st = memStorage();
    st.setItem("tracen-trail-progress-v1", "{not json");
    expect(loadProgress(st)).toEqual(emptyProgress());
  });

  it("visiting a topic does NOT complete it", () => {
    let p = emptyProgress();
    p = markVisited(p, 1);
    expect(p.visited).toContain(1);
    expect(isTopicComplete(p, 1)).toBe(false);
    expect(overallProgress(p, 20)).toBe(0);
  });

  it("completes only with simulation interaction AND a correct quiz answer", () => {
    let p = emptyProgress();
    p = completeTopic(p, 1, { simulationInteracted: true, quizCorrect: false });
    expect(isTopicComplete(p, 1)).toBe(false);
    p = completeTopic(p, 1, { simulationInteracted: false, quizCorrect: true });
    expect(isTopicComplete(p, 1)).toBe(false);
    p = completeTopic(p, 1, { simulationInteracted: true, quizCorrect: true });
    expect(isTopicComplete(p, 1)).toBe(true);
    expect(overallProgress(p, 20)).toBe(5); // 1/20
  });

  it("persists across reloads (storage round-trip)", () => {
    const st = memStorage();
    let p = emptyProgress();
    p = markVisited(p, 2);
    p = recordQuizAnswer(p, 2, 1, true);
    p = completeTopic(p, 2, { simulationInteracted: true, quizCorrect: true });
    p = { ...p, lastTopic: 2 };
    saveProgress(st, p);
    const reloaded = loadProgress(st);
    expect(reloaded.completed).toEqual([2]);
    expect(reloaded.quiz[2]).toEqual({ chosen: 1, correct: true });
    expect(reloaded.lastTopic).toBe(2);
    expect(isTopicComplete(reloaded, 2)).toBe(true);
  });

  it("reset actually clears everything", () => {
    const st = memStorage();
    let p = emptyProgress();
    p = completeTopic(p, 5, { simulationInteracted: true, quizCorrect: true });
    saveProgress(st, p);
    expect(st._dump().size).toBe(1);
    const cleared = resetProgress(st);
    expect(cleared).toEqual(emptyProgress());
    expect(st._dump().size).toBe(0);
    expect(loadProgress(st)).toEqual(emptyProgress());
  });

  it("does not duplicate completed topics", () => {
    let p = emptyProgress();
    p = completeTopic(p, 3, { simulationInteracted: true, quizCorrect: true });
    p = completeTopic(p, 3, { simulationInteracted: true, quizCorrect: true });
    expect(p.completed).toEqual([3]);
  });
});
