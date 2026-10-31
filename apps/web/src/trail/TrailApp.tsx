/**
 * TRACEN Vibe Coding Trail — application shell.
 * Hash-routed sub-app mounted as a view inside the host AEGIS dashboard.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";
import { TOPICS, getTopic } from "./content";
import { useTrailRoute } from "./router";
import {
  loadProgress,
  saveProgress,
  markVisited,
  completeTopic,
  recordQuizAnswer,
  overallProgress,
  resetProgress,
  ProgressState,
} from "./progress";
import { LandingView, JourneyView, GlossaryView, QuizView } from "./Views";
import { TopicPage } from "./TopicPage";
import { CaseStudyView } from "./CaseStudy";

const BROWSER_STORAGE = {
  getItem: (k: string) => window.localStorage.getItem(k),
  setItem: (k: string, v: string) => window.localStorage.setItem(k, v),
  removeItem: (k: string) => window.localStorage.removeItem(k),
};

export const TrailApp: React.FC = () => {
  const [route, navigate] = useTrailRoute();
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(BROWSER_STORAGE));
  const [simInteracted, setSimInteracted] = useState<Record<number, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    saveProgress(BROWSER_STORAGE, progress);
  }, [progress]);

  // visiting a topic records it (visit ≠ completion). The functional update
  // is idempotent: markVisited returns the same object when already visited,
  // so the persistence effect below does not re-write storage on re-renders.
  useEffect(() => {
    if (route.page === "topic") {
      setProgress((p) => {
        const marked = markVisited(p, route.id);
        if (marked === p && p.lastTopic === route.id) return p;
        return { ...marked, lastTopic: route.id };
      });
    }
  }, [route]);

  const handleSimInteract = useCallback((id: number) => {
    setSimInteracted((s) => (s[id] ? s : { ...s, [id]: true }));
  }, []);

  const handleQuizAnswer = useCallback((id: number, chosen: number, correct: boolean) => {
    setProgress((p) => recordQuizAnswer(p, id, chosen, correct));
  }, []);

  const handleMarkComplete = useCallback(
    (id: number, ev: { simulationInteracted: boolean; quizCorrect: boolean }) => {
      setProgress((p) => {
        const next = completeTopic(p, id, ev);
        return next === p ? p : next;
      });
    },
    []
  );

  const pct = overallProgress(progress, TOPICS.length);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Trail header / nav */}
      <nav className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-slate-600/40" aria-label="Trail sections">
        <a href="#/trail" className="text-lg font-extrabold tracking-wide text-slate-100 hover:text-sky-300">
          TRACEN <span className="text-sky-400 font-bold">Vibe Coding Trail</span>
        </a>
        <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">
          {progress.completed.length}/20 complete · {pct}%
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button variant={route.page === "landing" ? "primary" : "ghost"} onClick={() => navigate({ page: "landing" })}>Home</Button>
          <Button variant={route.page === "journey" ? "primary" : "ghost"} onClick={() => navigate({ page: "journey" })}>Journey</Button>
          <Button variant={route.page === "glossary" ? "primary" : "ghost"} onClick={() => navigate({ page: "glossary" })}>Glossary</Button>
          <Button variant={route.page === "quiz" ? "primary" : "ghost"} onClick={() => navigate({ page: "quiz" })}>Quiz</Button>
          <Button variant={route.page === "case-study" ? "primary" : "ghost"} onClick={() => navigate({ page: "case-study" })}>Case study</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                window.setTimeout(() => setConfirmReset(false), 4000);
                return;
              }
              setConfirmReset(false);
              setProgress(resetProgress(BROWSER_STORAGE));
              setSimInteracted({});
            }}
          >
            {confirmReset ? "Confirm reset?" : "Reset progress"}
          </Button>
        </div>
      </nav>

      <main>
        {route.page === "landing" && (
          <LandingView
            navigate={navigate}
            progressPct={pct}
            completed={progress.completed}
            lastTopic={progress.lastTopic}
          />
        )}
        {route.page === "journey" && <JourneyView navigate={navigate} completed={progress.completed} />}
        {route.page === "glossary" && <GlossaryView />}
        {route.page === "quiz" && (
          <QuizView
            answers={progress.finalQuiz}
            completed={progress.finalQuizCompleted}
            onAnswer={(index, chosen) =>
              setProgress((p) => ({ ...p, finalQuiz: { ...p.finalQuiz, [index]: chosen } }))
            }
            onFinish={() => setProgress((p) => ({ ...p, finalQuizCompleted: true }))}
          />
        )}
        {route.page === "case-study" && (
          <CaseStudyView onComplete={() => setProgress((p) => ({ ...p, caseStudyCompleted: true }))} />
        )}
        {route.page === "topic" &&
          (() => {
            const topic = getTopic(route.id);
            if (!topic) return <p className="text-slate-300">Topic not found.</p>;
            return (
              <TopicPage
                topic={topic}
                navigate={navigate}
                completed={progress.completed.includes(topic.id)}
                simInteracted={simInteracted}
                onSimInteract={handleSimInteract}
                quizAnswer={progress.quiz[topic.id]}
                onQuizAnswer={handleQuizAnswer}
                onMarkComplete={handleMarkComplete}
              />
            );
          })()}
      </main>
    </div>
  );
};
