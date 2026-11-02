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
  markSimInteracted,
  completeTopic,
  recordQuizAnswer,
  overallProgress,
  resetProgress,
  ProgressState,
} from "./progress";
import { parseHash } from "./router";
import { LandingView, JourneyView, GlossaryView, QuizView } from "./Views";
import { TopicPage } from "./TopicPage";
import { CaseStudyView } from "./CaseStudy";
import { StudioApp } from "../studio/StudioApp";

const BROWSER_STORAGE = {
  getItem: (k: string) => window.localStorage.getItem(k),
  setItem: (k: string, v: string) => window.localStorage.setItem(k, v),
  removeItem: (k: string) => window.localStorage.removeItem(k),
};

export const TrailApp: React.FC = () => {
  const [route, navigate] = useTrailRoute();
  // Progress is the single persisted source of truth, INCLUDING simulation-
  // interaction evidence — so completing requirements survive reloads.
  // A topic opened directly (deep link) is recorded as visited at load time.
  const [progress, setProgress] = useState<ProgressState>(() => {
    const loaded = loadProgress(BROWSER_STORAGE);
    const initial = parseHash(window.location.hash);
    if (initial.page === "topic") {
      return { ...markVisited(loaded, initial.id), lastTopic: initial.id };
    }
    return loaded;
  });
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    saveProgress(BROWSER_STORAGE, progress);
  }, [progress]);

  // Visits are recorded from the hashchange event itself, so browser
  // back/forward and in-app navigation behave identically. Visiting never
  // completes a topic.
  useEffect(() => {
    const onHashChange = () => {
      const r = parseHash(window.location.hash);
      if (r.page === "topic") {
        setProgress((p) => {
          const marked = markVisited(p, r.id);
          if (marked === p && p.lastTopic === r.id) return p;
          return { ...marked, lastTopic: r.id };
        });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleSimInteract = useCallback((id: number) => {
    setProgress((p) => markSimInteracted(p, id));
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

  // The Architecture Studio is a sibling area of the trail with its own shell.
  if (route.page === "studio") return <StudioApp tab={route.tab} navigate={navigate} />;

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
          <Button variant="ghost" onClick={() => navigate({ page: "studio", tab: "scenarios" })}>Architecture Studio →</Button>
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
                simInteracted={Object.fromEntries(progress.simInteracted.map((id) => [id, true]))}
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
