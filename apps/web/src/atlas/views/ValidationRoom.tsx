/**
 * Atlas — Validation Room (Tasks 28, 29, 30): review queue, the configured
 * policy, genuine validation-state evaluation, and the independent reviewer
 * workbench. Records are real (browser-local); identity trust and COI are
 * declared per record — nothing is fabricated.
 */

import React, { useMemo, useState } from "react";
import type { ArchitectureModel } from "../../lab/model";
import type { Project } from "../state";
import { AMetric, APanel, ABadge, AButton, AField, AInput, ASelect, AAnnouncer } from "../ui";
import {
  evaluateValidation, DEFAULT_POLICY, VALIDATION_LABELS, type ReviewRecord, type ValidationPolicy,
} from "../validation";
import { REVIEW_RUBRIC, validateAssessments, type ReviewAssessment } from "../../lab/engines/review";
import { CLAIMS } from "../../lab/engines/claims";
import { SOURCES } from "../../lab/engines/sources";

const nowIso = (): string => new Date().toISOString();

export const ValidationRoomView: React.FC<{
  model: ArchitectureModel;
  project: Project;
  reviews: ReviewRecord[];
  onRecordReview: (record: ReviewRecord) => void;
  setAnnounce: (m: string) => void;
}> = ({ model, project, reviews, onRecordReview, setAnnounce }) => {
  const [policy, setPolicy] = useState<ValidationPolicy>(DEFAULT_POLICY);
  const [verdict, setVerdict] = useState<ReviewAssessment["verdict"]>("agree");
  const [confidence, setConfidence] = useState(4);
  const [rationale, setRationale] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [coi, setCoi] = useState<ReviewRecord["coi"]>("independence-declared");
  const [identityTrust, setIdentityTrust] = useState<ReviewRecord["identityTrust"]>("self-declared");
  const [rubricSections, setRubricSections] = useState<string[]>(["correctness", "assumptions"]);

  const evaluation = useMemo(
    () => evaluateValidation(reviews, policy, { reviewRequested: false, now: nowIso() }),
    [reviews, policy],
  );

  const submit = (): void => {
    const assessment: ReviewAssessment = {
      id: `rev-${project.id}-${reviews.length + 1}-${Date.now()}`,
      targetId: `architecture:${project.id}`,
      reviewerId: reviewerName || "anonymous",
      identity: "self-declared",
      verdict, confidence: confidence as 1 | 2 | 3 | 4 | 5,
      rationale: rationale.trim(),
      evidenceRefs: [],
      submittedAt: nowIso(),
      disagreementKind: verdict === "disagree" ? "interpretation" : undefined,
    };
    const problems = validateAssessments([assessment]);
    if (problems.length > 0) {
      setAnnounce(`Assessment rejected: ${problems.map((p) => p.problem).join("; ")}`);
      return;
    }
    onRecordReview({ assessment, coi, identityTrust, rubricSections });
    setRationale("");
    setAnnounce(`Assessment recorded from ${assessment.reviewerId}. Validation state: ${VALIDATION_LABELS[evaluateValidation([...reviews, { assessment, coi, identityTrust, rubricSections }], policy, { reviewRequested: false, now: new Date().toISOString() }).state]}`);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <AAnnouncer message="" />
      <header className="mb-4">
        <h1 className="text-lg font-black text-slate-100">Validation Room</h1>
        <p className="text-xs text-slate-400">
          Independent validation for <strong>{project.name}</strong> — every state is derived from actual review records
          under the configured policy. No badge, count, or import alone proves independent validation.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <AMetric label="Current state" value={VALIDATION_LABELS[evaluation.state]} hint={evaluation.reasons[0] ?? ""} />
        <AMetric label="Human assessments" value={evaluation.derived.totalAssessments} hint={`${evaluation.derived.distinctReviewers} distinct reviewer(s)`} />
        <AMetric label="Verified identity" value={evaluation.derived.verifiedIdentity} hint={`policy requires ≥ ${policy.minVerifiedIdentity}`} />
        <AMetric label="Unresolved disputes" value={evaluation.derived.unresolvedDisagreements} hint="awaiting adjudication" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <APanel title="Validation policy (live)" subtitle="Policy evaluation runs over the real records on every change">
          <div className="grid gap-2 md:grid-cols-2 text-xs">
            <label className="space-y-1"><span className="text-[10px] uppercase text-slate-400">Min reviewers</span>
              <input type="number" min={1} value={policy.minReviewers} aria-label="Minimum reviewers"
                onChange={(e) => setPolicy({ ...policy, minReviewers: Number(e.target.value) || 1 })}
                className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5" /></label>
            <label className="space-y-1"><span className="text-[10px] uppercase text-slate-400">Min verified identity</span>
              <input type="number" min={1} value={policy.minVerifiedIdentity} aria-label="Minimum verified identity reviews"
                onChange={(e) => setPolicy({ ...policy, minVerifiedIdentity: Number(e.target.value) || 1 })}
                className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5" /></label>
            <label className="space-y-1"><span className="text-[10px] uppercase text-slate-400">Min confidence (1-5)</span>
              <input type="number" min={1} max={5} value={policy.minConfidence} aria-label="Minimum confidence"
                onChange={(e) => setPolicy({ ...policy, minConfidence: Number(e.target.value) || 1 })}
                className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5" /></label>
            <label className="space-y-1"><span className="text-[10px] uppercase text-slate-400">Max age (days)</span>
              <input type="number" min={1} value={policy.maxAgeDays} aria-label="Maximum assessment age in days"
                onChange={(e) => setPolicy({ ...policy, maxAgeDays: Number(e.target.value) || 1 })}
                className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5" /></label>
          </div>
          <ul className="mt-2 text-xs space-y-1">
            {evaluation.requirements.map((r) => (
              <li key={r.requirement} className="flex items-center gap-2">
                <ABadge status={r.satisfied ? "ok" : "warn"} label={r.satisfied ? "met" : "unmet"} /> {r.requirement}
              </li>
            ))}
          </ul>
        </APanel>

        <APanel title="Reviewer workbench" subtitle="Record a real human assessment — with COI declaration and identity trust honestly labeled">
          <div className="space-y-2 text-xs">
            <AField label="Your name (self-declared; anonymous is valid)">
              <AInput value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} aria-label="Reviewer name" />
            </AField>
            <div className="grid grid-cols-2 gap-2">
              <AField label="Verdict">
                <ASelect value={verdict} onChange={(e) => setVerdict(e.target.value as never)} aria-label="Verdict">
                  <option value="agree">agree</option><option value="disagree">disagree</option><option value="uncertain">uncertain</option>
                </ASelect>
              </AField>
              <AField label="Confidence (1-5)">
                <input type="number" min={1} max={5} value={confidence} aria-label="Confidence"
                  onChange={(e) => setConfidence(Number(e.target.value) || 1)}
                  className="w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5" />
              </AField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AField label="Conflict of interest">
                <ASelect value={coi} onChange={(e) => setCoi(e.target.value as never)} aria-label="Conflict of interest declaration">
                  <option value="independence-declared">independence declared</option>
                  <option value="conflict-disclosed">conflict disclosed</option>
                  <option value="none-declared">not declared</option>
                </ASelect>
              </AField>
              <AField label="Identity trust">
                <ASelect value={identityTrust} onChange={(e) => setIdentityTrust(e.target.value as never)} aria-label="Identity trust">
                  <option value="self-declared">self-declared (no verification)</option>
                  <option value="verified">verified by out-of-band proof</option>
                  <option value="none">none</option>
                </ASelect>
              </AField>
            </div>
            <AField label="Rubric sections substantively covered">
              <div className="flex flex-wrap gap-1">
                {REVIEW_RUBRIC.map((r) => (
                  <label key={r.dimension} className="inline-flex items-center gap-1 text-[11px] border border-slate-600 rounded px-1.5 py-0.5">
                    <input type="checkbox" checked={rubricSections.includes(r.dimension)}
                      onChange={(e) => setRubricSections((s) => e.target.checked ? [...s, r.dimension] : s.filter((x) => x !== r.dimension))} />
                    {r.dimension}
                  </label>
                ))}
              </div>
            </AField>
            <AField label="Rationale (required — an assessment without reasoning is invalid)">
              <textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} aria-label="Assessment rationale"
                className="w-full rounded-md border border-slate-600 bg-slate-800/80 p-2 text-xs" />
            </AField>
            <AButton variant="primary" onClick={submit} disabled={rationale.trim().length < 20}>Submit assessment</AButton>
            <p className="text-[10px] text-slate-500">
              The architecture under review: {model.components.length} components, {model.connections.length} connections.
              Claims and sources are browsable in Sources. Blinding: this workbench shows the architecture and evidence,
              not the author's workspace state.
            </p>
          </div>
        </APanel>

        <APanel title="Review records" subtitle="Append-only history with identity-trust and COI metadata">
          {reviews.length === 0 ? (
            <p className="text-xs text-slate-500">No assessments recorded for this architecture — the validation state honestly says so.</p>
          ) : (
            <ul className="text-xs space-y-2">
              {reviews.map((r) => (
                <li key={r.assessment.id} className="border border-slate-700/50 rounded-md p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ABadge status={r.assessment.verdict === "agree" ? "ok" : r.assessment.verdict === "disagree" ? "bad" : "warn"} label={r.assessment.verdict} />
                    <span className="text-slate-300">{r.assessment.reviewerId}</span>
                    <ABadge status={r.identityTrust === "verified" ? "ok" : "unknown"} label={r.identityTrust} />
                    <ABadge status={r.coi === "independence-declared" ? "ok" : r.coi === "none-declared" ? "warn" : "bad"} label={r.coi} />
                    <span className="text-slate-500">confidence {r.assessment.confidence}/5 · {r.assessment.submittedAt}</span>
                  </div>
                  <p className="mt-1 text-slate-400">{r.assessment.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </APanel>

        <APanel title="Claim & source trace (Task 31)" subtitle="Why the system makes its important technical claims">
          <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {CLAIMS.slice(0, 10).map((c) => (
              <li key={c.id}>
                <ABadge status={c.kind === "external" ? "ok" : "warn"} label={c.kind} /> {c.statement.slice(0, 110)}…
                <span className="block text-[10px] text-slate-500">
                  {c.sources.map((sid) => SOURCES.find((s) => s.id === sid)?.title).filter(Boolean).join(" · ") || "internal — no external citation (honest)"}
                </span>
              </li>
            ))}
          </ul>
        </APanel>
      </div>
    </div>
  );
};
