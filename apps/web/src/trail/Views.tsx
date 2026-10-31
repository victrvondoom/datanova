/**
 * Landing page, architecture journey map, glossary, and final quiz views.
 */
import React, { useMemo, useState } from "react";
import { Button, Callout, StateBadge } from "./ui";
import { FINAL_QUIZ, GLOSSARY, STAGES, TOPICS } from "./content";
import { TrailRoute, topicHref } from "./router";

/* -------------------------------------------------- Landing */

export const LandingView: React.FC<{
  navigate: (r: TrailRoute) => void;
  progressPct: number;
  completed: number[];
  lastTopic: number | null;
}> = ({ navigate, progressPct, completed, lastTopic }) => (
  <div className="space-y-6">
    <header className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-slate-800/60 to-slate-900/60 p-6 sm:p-8">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Tracen · Foundations</div>
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mt-2">Vibe Coding Trail</h1>
      <p className="text-slate-300 mt-2 max-w-2xl">
        AI coding assistants can generate a functional prototype in seconds. But when that prototype hits
        production, it faces a harsh reality: network drops, traffic spikes, database locks, and malicious
        traffic. <b>Vibe coding writes the syntax; system design ensures survival.</b>
      </p>
      <p className="text-sm text-slate-400 mt-2 max-w-2xl">
        Understand the systems behind your code. Build beyond the prototype — from understanding individual
        components to understanding a complete production application.
      </p>
      <div className="flex flex-wrap gap-3 items-center mt-5">
        <Button
          variant="primary"
          className="text-base px-5 py-2.5"
          onClick={() => navigate({ page: "topic", id: 1 })}
        >
          Start Topic 01 — Rate Limiting
        </Button>
        {lastTopic !== null && (
          <Button onClick={() => navigate({ page: "topic", id: lastTopic })}>
            Continue: Topic {String(lastTopic).padStart(2, "0")}
          </Button>
        )}
        <Button onClick={() => navigate({ page: "journey" })}>Open the architecture journey</Button>
      </div>
    </header>

    <section>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-bold text-slate-100">Your progress</h2>
        <span className="text-sm font-mono text-sky-300">{progressPct}% complete · {completed.length}/20 topics</span>
      </div>
      <div className="h-3 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
        <div className="h-full bg-sky-400/70 transition-all" style={{ width: `${progressPct}%` }} />
      </div>
    </section>

    <section>
      <h2 className="text-lg font-bold text-slate-100 mb-3">The architecture journey — five stages of a request</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate({ page: "journey" })}
            className="text-left rounded-xl border border-slate-600/50 bg-slate-800/50 p-4 hover:border-sky-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-sky-300">{s.label}</div>
            <div className="text-sm text-slate-300 mt-1">{s.mission}</div>
            <div className="text-[11px] text-slate-400 mt-2 font-mono">
              {s.topicIds.map((id) => `T${String(id).padStart(2, "0")}`).join(" · ")}
            </div>
          </button>
        ))}
      </div>
    </section>

    <section>
      <h2 className="text-lg font-bold text-slate-100 mb-3">Topic navigator</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {TOPICS.map((t) => {
          const done = completed.includes(t.id);
          return (
            <a
              key={t.id}
              href={topicHref(t.id)}
              className={`rounded-lg border p-3 hover:border-sky-400 transition-colors ${
                done ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-600/50 bg-slate-800/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{String(t.id).padStart(2, "0")}</span>
                {done ? <StateBadge state="recovered" label="Done" /> : <StateBadge state="idle" />}
              </div>
              <div className="text-sm font-semibold text-slate-100 mt-1">{t.title}</div>
            </a>
          );
        })}
      </div>
    </section>
  </div>
);

/* -------------------------------------------------- Journey map */

export const JourneyView: React.FC<{ navigate: (r: TrailRoute) => void; completed: number[] }> = ({
  navigate,
  completed,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>(STAGES[0].id);
  const stage = STAGES.find((s) => s.id === selectedStage)!;
  const stageLabel: Record<string, { sync: string }> = {
    entry: { sync: "synchronous — every request passes the edge" },
    routing: { sync: "synchronous — request follows the routing path" },
    execution: { sync: "synchronous — request handled by app + data layer" },
    reliability: { sync: "synchronous calls guarded by reliability mechanisms" },
    async: { sync: "ASYNCHRONOUS — queues, events, and workflows" },
  };
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-100">The Architecture Journey</h2>
      <p className="text-sm text-slate-400">
        The lifecycle of a request: <span className="text-sky-300">Client → Edge Protection → Routing → API
        Gateway → Application → Data/Cache → Async Processing → Workers → Events → Distributed Workflows.</span>{" "}
        Solid arrows are synchronous; dashed arrows are asynchronous. Every node is clickable.
      </p>

      <div className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 min-w-max">
          {[
            { l: "Client", stage: "entry", t: 1 },
            { l: "Edge Protection", stage: "entry", t: 1 },
            { l: "Load Balancer", stage: "routing", t: 3 },
            { l: "Reverse Proxy", stage: "routing", t: 4 },
            { l: "API Gateway", stage: "routing", t: 5 },
            { l: "Service Discovery", stage: "execution", t: 9 },
            { l: "Application", stage: "execution", t: 8 },
            { l: "Data / Cache", stage: "routing", t: 2 },
          ].map((n) => (
            <React.Fragment key={n.l}>
              <button
                type="button"
                onClick={() => navigate({ page: "topic", id: n.t })}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold hover:border-sky-400 ${
                  stage.id === n.stage ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-slate-500/50 bg-slate-700/50 text-slate-200"
                }`}
              >
                {n.l}
                <div className="text-[10px] font-mono text-slate-400">T{String(n.t).padStart(2, "0")}</div>
              </button>
              <span aria-hidden="true" className="text-sky-400 font-mono">→</span>
            </React.Fragment>
          ))}
          <button
            type="button"
            onClick={() => navigate({ page: "topic", id: 15 })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold hover:border-sky-400 ${
              stage.id === "async" ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-slate-500/50 bg-slate-700/50 text-slate-200"
            }`}
          >
            Async Processing
            <div className="text-[10px] font-mono text-slate-400">T15</div>
          </button>
          <span aria-hidden="true" className="text-slate-500 font-mono">┄→</span>
          <button
            type="button"
            onClick={() => navigate({ page: "topic", id: 17 })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold hover:border-sky-400 ${
              stage.id === "async" ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-slate-500/50 bg-slate-700/50 text-slate-200"
            }`}
          >
            Events & Workflows
            <div className="text-[10px] font-mono text-slate-400">T16-19</div>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Legend: <span className="text-sky-400 font-mono">→</span> synchronous request path ·{" "}
          <span className="text-slate-400 font-mono">┄→</span> asynchronous (queued/event) path. Failures
          concentrate where arrows leave the synchronous path: overload (T1), downstream failure (T10-13),
          duplicate work (T14, T20), partial writes (T18-19).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <Button key={s.id} variant={s.id === selectedStage ? "primary" : "ghost"} onClick={() => setSelectedStage(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4">
        <div className="text-xs text-slate-400 mb-2 font-mono">{stageLabel[stage.id].sync}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stage.topicIds.map((id) => {
            const topic = TOPICS.find((t) => t.id === id)!;
            return (
              <a
                key={id}
                href={topicHref(id)}
                className="rounded-lg border border-slate-600/50 bg-slate-700/40 p-3 hover:border-sky-400"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">Topic {String(id).padStart(2, "0")}</span>
                  {completed.includes(id) ? <StateBadge state="recovered" label="Done" /> : null}
                </div>
                <div className="font-semibold text-slate-100 text-sm mt-1">{topic.title}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">{topic.problem}</div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------- Glossary */

export const GlossaryView: React.FC = () => {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(
      (g) =>
        g.term.toLowerCase().includes(q) ||
        g.definition.toLowerCase().includes(q) ||
        g.components.some((c) => c.toLowerCase().includes(q))
    );
  }, [query]);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-100">Glossary</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search terms, definitions, or components…"
        aria-label="Search glossary"
        className="w-full sm:max-w-md rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      />
      <p className="text-xs text-slate-400">
        {results.length} of {GLOSSARY.length} entries
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {results.map((g) => (
          <div key={g.term} className="rounded-xl border border-slate-600/50 bg-slate-800/50 p-4">
            <div className="font-bold text-slate-100">{g.term}</div>
            <p className="text-sm text-slate-300 mt-1">{g.definition}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {g.topicIds.map((id) => (
                <a
                  key={id}
                  href={topicHref(id)}
                  className="rounded bg-sky-500/15 border border-sky-500/40 px-2 py-0.5 text-[11px] font-mono text-sky-300 hover:bg-sky-500/25"
                >
                  Topic {String(id).padStart(2, "0")}
                </a>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Related: {g.components.join(" · ")}</div>
          </div>
        ))}
      </div>
      {results.length === 0 && (
        <Callout kind="info" title="No matches">
          No glossary entry matches "{query}". Try a shorter term.
        </Callout>
      )}
    </div>
  );
};

/* -------------------------------------------------- Final quiz */

export const QuizView: React.FC<{
  answers: Record<number, number>;
  onAnswer: (index: number, chosen: number) => void;
  onFinish: (correct: number) => void;
  completed: boolean;
}> = ({ answers, onAnswer, onFinish, completed }) => {
  const [reviewing, setReviewing] = useState(false);
  const correctCount = FINAL_QUIZ.reduce((a, q, i) => a + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const answeredAll = Object.keys(answers).length === FINAL_QUIZ.length;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-100">Knowledge Check — Final Verification</h2>
      <p className="text-sm text-slate-400">The handbook's five original questions. Immediate feedback; retry incorrect answers freely.</p>
      {FINAL_QUIZ.map((q, qi) => {
        const chosen = answers[qi];
        const answered = chosen !== undefined;
        const correct = chosen === q.answerIndex;
        return (
          <div key={qi} className="rounded-xl border border-slate-600/50 bg-slate-800/50 p-4">
            <div className="font-semibold text-slate-100">{qi + 1}. {q.question}</div>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, oi) => {
                const isChosen = chosen === oi;
                const isAnswer = q.answerIndex === oi;
                const showState = answered && (isChosen || (reviewing && isAnswer));
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => onAnswer(qi, oi)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      showState
                        ? isAnswer
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/60 bg-rose-500/10 text-rose-200"
                        : "border-slate-600/50 bg-slate-700/40 text-slate-200 hover:border-sky-400"
                    }`}
                  >
                    {opt}
                    {showState && isAnswer && <span className="ml-2 text-xs font-bold">← correct</span>}
                    {showState && !isAnswer && isChosen && <span className="ml-2 text-xs font-bold">← your answer</span>}
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className={`mt-2 text-sm rounded-lg border p-2 ${correct ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
                {correct ? "✓ Correct. " : "✗ Not quite — retry. "}
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="primary"
          disabled={!answeredAll}
          onClick={() => {
            setReviewing(true);
            onFinish(correctCount);
          }}
        >
          Finish and score
        </Button>
        {completed && (
          <span className="text-sm font-mono text-emerald-400">
            Completed — final score: {correctCount}/{FINAL_QUIZ.length} correct
          </span>
        )}
      </div>
      {reviewing && (
        <Callout kind={correctCount === FINAL_QUIZ.length ? "info" : "warning"} title="Completion summary">
          You scored {correctCount} of {FINAL_QUIZ.length}.{" "}
          {correctCount === FINAL_QUIZ.length
            ? "All five handbook questions verified — you can explain why production systems are designed the way they are."
            : "Retry the incorrect answers: production readiness is about knowing the failure modes, not memorizing definitions."}
        </Callout>
      )}
    </div>
  );
};
