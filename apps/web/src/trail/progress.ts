/**
 * Learning progress persistence.
 *
 * Lightweight by design: this is a local learning application without
 * accounts, so progress lives in localStorage behind a small storage
 * interface (injected for testability). No backend is used — the spec
 * forbids introducing one solely for a progress indicator.
 */

export interface ProgressState {
  /** topics the user opened */
  visited: number[];
  /** topics whose learning interaction + knowledge check were completed */
  completed: number[];
  /** topic quiz answers: topicId -> {chosen, correct} */
  quiz: Record<number, { chosen: number; correct: boolean }>;
  /** final 5-question quiz: chosen indices */
  finalQuiz: Record<number, number>;
  finalQuizCompleted: boolean;
  caseStudyCompleted: boolean;
  lastTopic: number | null;
}

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "tracen-trail-progress-v1";

export const emptyProgress = (): ProgressState => ({
  visited: [],
  completed: [],
  quiz: {},
  finalQuiz: {},
  finalQuizCompleted: false,
  caseStudyCompleted: false,
  lastTopic: null,
});

export function loadProgress(storage: ProgressStorage): ProgressState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      quiz: parsed.quiz && typeof parsed.quiz === "object" ? parsed.quiz : {},
      finalQuiz:
        parsed.finalQuiz && typeof parsed.finalQuiz === "object" ? parsed.finalQuiz : {},
      finalQuizCompleted: parsed.finalQuizCompleted === true,
      caseStudyCompleted: parsed.caseStudyCompleted === true,
      lastTopic: typeof parsed.lastTopic === "number" ? parsed.lastTopic : null,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: ProgressStorage, p: ProgressState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function markVisited(p: ProgressState, topicId: number): ProgressState {
  if (p.visited.includes(topicId)) return p;
  return { ...p, visited: [...p.visited, topicId].sort((a, b) => a - b) };
}

/**
 * Completion is NOT granted merely for opening a topic. A topic becomes
 * completed only when both conditions hold: the learning interaction
 * (simulation) was exercised AND the topic knowledge check was answered
 * correctly.
 */
export interface CompletionEvidence {
  simulationInteracted: boolean;
  quizCorrect: boolean;
}

export function isTopicComplete(p: ProgressState, topicId: number): boolean {
  return p.completed.includes(topicId);
}

export function completeTopic(p: ProgressState, topicId: number, ev: CompletionEvidence): ProgressState {
  if (!ev.simulationInteracted || !ev.quizCorrect) return p;
  if (p.completed.includes(topicId)) return p;
  return { ...p, completed: [...p.completed, topicId].sort((a, b) => a - b) };
}

export function recordQuizAnswer(
  p: ProgressState,
  topicId: number,
  chosen: number,
  correct: boolean
): ProgressState {
  return { ...p, quiz: { ...p.quiz, [topicId]: { chosen, correct } } };
}

export function overallProgress(p: ProgressState, totalTopics: number): number {
  return Math.round((p.completed.length / totalTopics) * 100);
}

export function resetProgress(storage: ProgressStorage): ProgressState {
  storage.removeItem(STORAGE_KEY);
  return emptyProgress();
}
