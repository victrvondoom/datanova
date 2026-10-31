/**
 * Individual topic learning page: content sections, interactive simulation,
 * knowledge check, and previous/next navigation.
 *
 * Completion requires BOTH the simulation interaction AND a correct
 * knowledge-check answer — opening a page never marks it complete.
 */
import React, { useEffect } from "react";
import { Button, StateBadge } from "./ui";
import { TOPICS, Topic, stageOf } from "./content";
import { SIM_COMPONENTS } from "./sims/registry";
import { TrailRoute, topicHref } from "./router";

export const TopicPage: React.FC<{
  topic: Topic;
  navigate: (r: TrailRoute) => void;
  completed: boolean;
  simInteracted: Record<number, boolean>;
  onSimInteract: (id: number) => void;
  quizAnswer: { chosen: number; correct: boolean } | undefined;
  onQuizAnswer: (id: number, chosen: number, correct: boolean) => void;
  onMarkComplete: (id: number, evidence: { simulationInteracted: boolean; quizCorrect: boolean }) => void;
}> = ({ topic, navigate, completed, simInteracted, onSimInteract, quizAnswer, onQuizAnswer, onMarkComplete }) => {
  const Sim = SIM_COMPONENTS[topic.id];
  const stage = stageOf(topic.id)!;
  const prev = TOPICS.find((t) => t.id === topic.id - 1);
  const next = TOPICS.find((t) => t.id === topic.id + 1);
  const interacted = simInteracted[topic.id] === true;
  const quizCorrect = quizAnswer?.correct === true;

  useEffect(() => {
    if (interacted && quizCorrect && !completed) {
      onMarkComplete(topic.id, { simulationInteracted: true, quizCorrect: true });
    }
  }, [interacted, quizCorrect, completed, topic.id, onMarkComplete]);

  return (
    <article className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-sky-300">
            Topic {String(topic.id).padStart(2, "0")} · {stage.label} · {stage.mission}
          </span>
          {completed && <StateBadge state="recovered" label="Completed" />}
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mt-1">{topic.title}</h1>
      </header>

      <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-1">The Problem</h2>
        <p className="text-slate-300">{topic.problem}</p>
      </section>

      <section className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-1">The Explanation</h2>
        <p className="text-slate-300">{topic.explanation}</p>
        <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-sm text-slate-300">
          <span className="font-bold text-violet-300">Analogy: </span>
          {topic.analogy}
        </div>
      </section>

      <section className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-1">Technical Detail</h2>
        <p className="text-slate-300 font-mono text-sm leading-relaxed">{topic.technical}</p>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">Interactive Simulation</h2>
        <p className="text-xs text-slate-400 mb-2">
          Use the controls — completion requires actually interacting with this simulation, not just reading.
          {!interacted && <span className="text-amber-300"> (interaction pending)</span>}
          {interacted && <span className="text-emerald-400"> (interaction recorded ✓)</span>}
        </p>
        {Sim ? <Sim onInteract={() => onSimInteract(topic.id)} /> : <p className="text-slate-400">Simulation unavailable.</p>}
      </section>

      <section className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">Step-by-Step Walkthrough</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300">
          {topic.walkthrough.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Failure Scenario</h2>
        <p className="text-slate-300">{topic.failureScenario}</p>
      </section>

      <section className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-1">Trade-offs & Limitations</h2>
        <p className="text-slate-300">{topic.tradeoffs}</p>
      </section>

      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Practical Takeaway</h2>
        <p className="text-slate-300">{topic.takeaway}</p>
      </section>

      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">Knowledge Check</h2>
        <p className="font-semibold text-slate-100">{topic.quiz.question}</p>
        <div className="mt-2 space-y-2">
          {topic.quiz.options.map((opt, oi) => {
            const chosen = quizAnswer?.chosen === oi;
            const isAnswer = topic.quiz.answerIndex === oi;
            const showState = quizAnswer !== undefined && (chosen || (quizAnswer.correct && isAnswer));
            return (
              <button
                key={oi}
                type="button"
                onClick={() => onQuizAnswer(topic.id, oi, oi === topic.quiz.answerIndex)}
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
              </button>
            );
          })}
        </div>
        {quizAnswer && (
          <div className={`mt-2 text-sm rounded-lg border p-2 ${quizAnswer.correct ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
            {quizAnswer.correct ? "✓ Correct. " : "✗ Try again — you can retry freely. "}
            {topic.quiz.explanation}
          </div>
        )}
        {!completed && interacted && quizCorrect && <p className="text-xs text-emerald-400 mt-2">Topic completed ✓</p>}
        {!completed && (!interacted || !quizCorrect) && (
          <p className="text-xs text-slate-400 mt-2">
            To mark this topic complete: interact with the simulation
            {interacted ? " (done ✓)" : ""} and answer the knowledge check correctly
            {quizCorrect ? " (done ✓)" : ""}.
          </p>
        )}
      </section>

      <nav className="flex items-center justify-between gap-2 pb-4" aria-label="Topic navigation">
        {prev ? (
          <Button onClick={() => navigate({ page: "topic", id: prev.id })}>
            ← {String(prev.id).padStart(2, "0")} {prev.title}
          </Button>
        ) : (
          <Button onClick={() => navigate({ page: "landing" })}>← Trail home</Button>
        )}
        <a href={topicHref(topic.id)} className="text-xs font-mono text-slate-500 hover:text-sky-300">
          #{topicHref(topic.id)}
        </a>
        {next ? (
          <Button variant="primary" onClick={() => navigate({ page: "topic", id: next.id })}>
            {String(next.id).padStart(2, "0")} {next.title} →
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate({ page: "case-study" })}>
            End-to-end case study →
          </Button>
        )}
      </nav>
    </article>
  );
};
