/**
 * Content structure tests: exactly 20 topics, correct numbering and
 * ordering, all five stages represented, every topic has its required
 * learning sections, prev/next links resolve, and glossary entries link to
 * valid topics.
 */
import { describe, expect, it } from "vitest";
import { FINAL_QUIZ, GLOSSARY, STAGES, TOPICS, getTopic, stageOf } from "../content";
import { parseHash, topicHref } from "../router";

describe("topic inventory", () => {
  it("contains exactly 20 topics", () => {
    expect(TOPICS).toHaveLength(20);
  });

  it("has correct, non-duplicated, sequential numbering 1..20", () => {
    const ids = TOPICS.map((t) => t.id);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(ids).size).toBe(20);
  });

  it("covers all five architecture stages with the handbook's topic placement", () => {
    expect(STAGES).toHaveLength(5);
    const stageTopics = STAGES.flatMap((s) => s.topicIds).sort((a, b) => a - b);
    expect(stageTopics).toEqual(TOPICS.map((t) => t.id));
    // handbook layout: entry=1, routing=2-5, execution=6-9, reliability=10-14, async=15-20
    expect(STAGES[0].topicIds).toEqual([1]);
    expect(STAGES[1].topicIds).toEqual([2, 3, 4, 5]);
    expect(STAGES[2].topicIds).toEqual([6, 7, 8, 9]);
    expect(STAGES[3].topicIds).toEqual([10, 11, 12, 13, 14]);
    expect(STAGES[4].topicIds).toEqual([15, 16, 17, 18, 19, 20]);
  });

  it("gives every topic all required learning sections", () => {
    for (const t of TOPICS) {
      expect(t.title.trim().length, `topic ${t.id} title`).toBeGreaterThan(0);
      expect(t.problem.length, `topic ${t.id} problem`).toBeGreaterThan(20);
      expect(t.explanation.length, `topic ${t.id} explanation`).toBeGreaterThan(20);
      expect(t.analogy.length, `topic ${t.id} analogy`).toBeGreaterThan(10);
      expect(t.technical.length, `topic ${t.id} technical`).toBeGreaterThan(20);
      expect(t.walkthrough.length, `topic ${t.id} walkthrough`).toBeGreaterThanOrEqual(4);
      expect(t.failureScenario.length, `topic ${t.id} failure scenario`).toBeGreaterThan(20);
      expect(t.tradeoffs.length, `topic ${t.id} tradeoffs`).toBeGreaterThan(20);
      expect(t.takeaway.length, `topic ${t.id} takeaway`).toBeGreaterThan(20);
      // knowledge check
      expect(t.quiz.options.length).toBeGreaterThanOrEqual(2);
      expect(t.quiz.answerIndex).toBeLessThan(t.quiz.options.length);
      expect(t.quiz.explanation.length).toBeGreaterThan(10);
    }
  });

  it("assigns every topic to exactly one stage", () => {
    for (const t of TOPICS) {
      expect(stageOf(t.id), `topic ${t.id} stage`).toBeDefined();
    }
  });

  it("provides valid previous/next navigation (ids are sequential and resolvable)", () => {
    for (const t of TOPICS) {
      const prev = getTopic(t.id - 1);
      const next = getTopic(t.id + 1);
      if (t.id > 1) expect(prev).toBeDefined();
      if (t.id < 20) expect(next).toBeDefined();
      expect(topicHref(t.id)).toBe(`#/trail/topic/${String(t.id).padStart(2, "0")}`);
    }
  });
});

describe("glossary", () => {
  it("contains every required term", () => {
    const required = [
      "API Gateway", "Cache", "Cache Hit", "Cache Miss", "Circuit Breaker", "CI/CD",
      "Container", "Docker Image", "Dead Letter Queue (DLQ)", "Distributed Transaction",
      "Event Bus", "Eventual Consistency", "Idempotency", "Jitter", "Load Balancer",
      "Pub/Sub", "Reverse Proxy", "Saga", "Service Discovery", "Token Bucket", "TTL (Time-To-Live)", "Worker",
    ];
    const terms = new Set(GLOSSARY.map((g) => g.term));
    for (const r of required) expect(terms, `missing glossary term: ${r}`).toContain(r);
  });

  it("links every entry to valid topics with definitions and components", () => {
    for (const g of GLOSSARY) {
      expect(g.definition.length).toBeGreaterThan(20);
      expect(g.components.length).toBeGreaterThan(0);
      expect(g.topicIds.length).toBeGreaterThan(0);
      for (const id of g.topicIds) {
        expect(getTopic(id), `glossary ${g.term} links to topic ${id}`).toBeDefined();
      }
    }
  });

  it("has unique terms", () => {
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length);
  });
});

describe("final quiz", () => {
  it("contains the handbook's five original questions", () => {
    expect(FINAL_QUIZ).toHaveLength(5);
    expect(FINAL_QUIZ[0].question).toMatch(/CORS/i);
    expect(FINAL_QUIZ[1].question).toMatch(/Jitter/i);
    expect(FINAL_QUIZ[2].question).toMatch(/Message Queue/i);
    expect(FINAL_QUIZ[3].question).toMatch(/inventory/i);
    expect(FINAL_QUIZ[4].question).toMatch(/running instance/i);
  });
});

describe("hash router", () => {
  it("parses trail routes and rejects invalid topic ids", () => {
    expect(parseHash("#/trail")).toEqual({ page: "landing" });
    expect(parseHash("#/trail/journey")).toEqual({ page: "journey" });
    expect(parseHash("#/trail/glossary")).toEqual({ page: "glossary" });
    expect(parseHash("#/trail/quiz")).toEqual({ page: "quiz" });
    expect(parseHash("#/trail/case-study")).toEqual({ page: "case-study" });
    expect(parseHash("#/trail/topic/01")).toEqual({ page: "topic", id: 1 });
    expect(parseHash("#/trail/topic/20")).toEqual({ page: "topic", id: 20 });
    expect(parseHash("#/trail/topic/21")).toEqual({ page: "landing" });
    expect(parseHash("")).toEqual({ page: "landing" });
  });
});
