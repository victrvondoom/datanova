/**
 * Campaign 05 — Evidence Exchange panel (Tasks 21-33, 35, 38-40).
 *
 * The user-to-user loop: build a package from the current architecture and
 * scenario, inspect privacy before export, export deterministic JSON;
 * paste a received package, validate it in isolation, preview it, accept or
 * reject staged adoption; annotate findings, return a review response; and
 * inspect the cross-user provenance chain. All state is local (localStorage)
 * — no backend, no invented cloud service.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Download, Inbox, Mail, Send, ShieldCheck, Trash2 } from "lucide-react";
import type { ArchitectureModel } from "../model";
import { parseModel, diffModels, serializeModel } from "../model";
import { Btn, Callout, Panel, Announcer } from "../ui";
import {
  buildDepPackage, serializeDep, validateDep, inspectSensitive, depDigest, replayDepScenario,
  type ImportVerdict, type AuthorInfo,
} from "../engines/dep";
import {
  draftPackage, markExported, receivePackage, inspectPackage, acceptPackage, rejectPackage,
  addAnnotation, resolveAnnotation, reopenAnnotation, danglingAnnotations,
  buildReviewResponse, validateReviewResponse, responseSummary,
  reconcileResponse,
  appendProvenanceEvent, verifyProvenanceChain, provenanceTimeline,
  deleteExchangeData, emptyExchangeState, ExchangeError,
  type ExchangeState,
} from "../engines/exchange";
import { scenarioTemplate, runScenario } from "../engines/scenario";
import { extractGenome } from "../engines/genome";
import { critiqueArchitecture } from "../engines/critic";
import { captureFinding } from "../engines/evidence";

const EXCHANGE_KEY = "tracen-lab-exchange-v1";

/** Wall-clock for exchange events — only called from event handlers, never during render. */
const at = (): string => new Date().toISOString();

type ProvEvent = Parameters<typeof appendProvenanceEvent>[0][number];

const loadExchange = (): { exchange: ExchangeState; provenance: ProvEvent[] } => {
  try {
    const raw = window.localStorage.getItem(EXCHANGE_KEY);
    if (!raw) return { exchange: emptyExchangeState(), provenance: [] };
    const parsed = JSON.parse(raw) as { exchange: ExchangeState; provenance: ProvEvent[] };
    return {
      exchange: parsed.exchange ?? emptyExchangeState(),
      provenance: parsed.provenance ?? [],
    };
  } catch {
    return { exchange: emptyExchangeState(), provenance: [] };
  }
};

export const ExchangePanel: React.FC<{ model: ArchitectureModel; onAdoptJson: (modelJson: string) => void }> = ({ model, onAdoptJson }) => {
  const [{ exchange, provenance }, setState] = useState(loadExchange);

  useEffect(() => {
    window.localStorage.setItem(EXCHANGE_KEY, JSON.stringify({ exchange, provenance }));
  }, [exchange, provenance]);

  const [announce, setAnnounce] = useState("");
  const [authorName, setAuthorName] = useState("Anonymous architect");
  const [includeEmail, setIncludeEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [scenarioEnabled, setScenarioEnabled] = useState(true);
  const [exportedText, setExportedText] = useState("");
  const [sensitive, setSensitive] = useState<ReturnType<typeof inspectSensitive>>([]);
  const [importText, setImportText] = useState("");
  const [verdict, setVerdict] = useState<ImportVerdict | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState("");
  const [selectedInbox, setSelectedInbox] = useState<string>("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "pending" | "closed">("all");

  const inboxItems = exchange.items.filter((i) => i.direction === "inbox");
  const outboxItems = exchange.items.filter((i) => i.direction === "outbox");
  const selectedItem = exchange.items.find((i) => i.packageId === selectedInbox) ?? null;

  const knownPackages = useMemo(
    () => exchange.items.filter((i) => i.package_).map((i) => ({ packageId: i.packageId, digest: i.digest })),
    [exchange],
  );

  // --- export flow (Tasks 22/25/28/33) ---
  const buildAndExport = (): void => {
    const scenario = scenarioEnabled ? scenarioTemplate("burst-overload", model, 120) : null;
    const results = scenario ? runScenario(model, scenario).expectationResults : [];
    const findings = critiqueArchitecture(model).findings;
    const author: AuthorInfo = {
      name: authorName || "anonymous", email: email || undefined, identity: "self-declared",
    };
    const pkg = buildDepPackage({
      model,
      archFingerprint: extractGenome(model).fingerprint,
      scenario,
      results,
      evidence: findings.slice(0, 5).map((f) => captureFinding(f, { createdAt: at(), archFingerprint: extractGenome(model).fingerprint })),
      createdBy: author,
      createdAt: at(),
    }, { includeEmail });
    const text = serializeDep(pkg);
    setExportedText(text);
    setSensitive(inspectSensitive(pkg));
    setState((s) => {
      let next = s.exchange;
      try {
        next = draftPackage(s.exchange, pkg, at());
        next = markExported(next, pkg.packageId, at());
      } catch (e) {
        // already drafted: re-export the same immutable package is a no-op
        if (!(e instanceof ExchangeError)) throw e;
      }
      return {
        exchange: next,
        provenance: appendProvenanceEvent(s.provenance, {
          type: "exported", at: at(), actor: authorName || "anonymous",
          packageId: pkg.packageId, digest: depDigest(pkg), note: "exported for review",
        }),
      };
    });
    setAnnounce(`Package exported: ${pkg.packageId}. ${inspectSensitive(pkg).length} sensitive field(s) found by the privacy scan.`);
  };

  const download = (name: string, text: string): void => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- import flow (Tasks 24/26/28) ---
  const validateImport = (): void => {
    const v = validateDep(importText);
    setVerdict(v);
    setAnnounce(v.valid
      ? `Package valid: ${v.preview!.packageId} by ${v.preview!.createdBy}, ${v.preview!.components} components, ${v.preview!.evidence} evidence items.`
      : `Import rejected with ${v.problems.length} problem(s): ${v.problems[0]}`);
  };

  const receiveValidated = (): void => {
    if (!verdict?.valid || !verdict.package_) return;
    setState((s) => {
      try {
        const next = receivePackage(s.exchange, verdict.package_!, at());
        setAnnounce(`Package ${verdict.package_!.packageId} received into the inbox — inspect before accepting.`);
        return {
          exchange: next,
          provenance: appendProvenanceEvent(s.provenance, {
            type: "imported", at: at(), actor: authorName || "anonymous",
            packageId: verdict.package_!.packageId, digest: depDigest(verdict.package_!),
            note: `received from ${verdict.package_!.createdBy.name}`,
          }),
        };
      } catch (e) {
        if (e instanceof ExchangeError) {
          setAnnounce(`Receive failed: ${e.message}`);
          return { exchange: s.exchange, provenance: s.provenance };
        }
        throw e;
      }
    });
    setImportText("");
    setVerdict(null);
  };

  const acceptInbox = (packageId: string): void => {
    const item = exchange.items.find((i) => i.packageId === packageId);
    if (!item?.package_) return;
    setState((s) => ({
      exchange: acceptPackage(s.exchange, packageId, at()),
      provenance: appendProvenanceEvent(s.provenance, {
        type: "accepted", at: at(), actor: authorName || "anonymous", packageId, digest: item.digest, note: "staged adoption approved",
      }),
    }));
    // staged adoption: apply the packaged (already canonical-validated) architecture
    onAdoptJson(serializeModel(parseModel(item.package_.modelJson)));
    setAnnounce(`Package ${packageId} accepted: the packaged architecture is now staged as the working architecture.`);
  };

  const rejectInbox = (packageId: string): void => {
    setState((s) => ({ exchange: rejectPackage(s.exchange, packageId, at()), provenance: s.provenance }));
    setAnnounce(`Package ${packageId} rejected — no workspace data was modified.`);
  };

  const inspectInbox = (packageId: string): void => {
    setState((s) => ({ exchange: inspectPackage(s.exchange, packageId, at()), provenance: s.provenance }));
    setAnnounce(`Package ${packageId} inspection recorded.`);
  };

  // --- annotation flow (Task 29) ---
  const [annTarget, setAnnTarget] = useState("");
  const [annComment, setAnnComment] = useState("");
  const annotate = (): void => {
    if (!selectedInbox || !annTarget || !annComment) return;
    try {
      setState((s) => ({
        exchange: addAnnotation(s.exchange, selectedInbox, {
          target: annTarget as never, comment: annComment, author: authorName || "anonymous", createdAt: at(),
        }),
        provenance: s.provenance,
      }));
      setAnnComment("");
      setAnnounce("Annotation added and linked to its target in the received package.");
    } catch (e) {
      setAnnounce(`Annotation rejected: ${(e as Error).message}`);
    }
  };

  // --- response flow (Task 30) ---
  const itemForResponse = outboxItems[0] ?? inboxItems[0];
  const sendResponse = (): void => {
    if (!itemForResponse?.package_) return;
    const response = buildReviewResponse(
      itemForResponse.package_,
      { name: authorName || "anonymous", identity: "self-declared" },
      (selectedItem && selectedItem.packageId === itemForResponse.packageId) ? selectedItem.annotations : [],
      "request-changes",
      [],
      [],
      at(),
    );
    const text = JSON.stringify(response);
    download(`review-response-${response.responseId}.json`, text);
    setAnnounce(`Review response exported (${response.annotations.length} annotation(s), verdict: request-changes).`);
  };

  const importResponse = (): void => {
    const target = outboxItems.find((i) => i.package_)?.packageId;
    const pkg = exchange.items.find((i) => i.packageId === target)?.package_;
    if (!pkg) {
      setResponseError("No exported package in the outbox to review against.");
      return;
    }
    const v = validateReviewResponse(responseText, pkg);
    if (!v.valid) {
      setResponseError(v.problems.join("; "));
      setAnnounce(`Response import failed: ${v.problems[0]}`);
      return;
    }
    const summary = responseSummary(v.response!);
    const rec = reconcileResponse(pkg, pkg, v.response!);
    setResponseError("");
    setAnnounce(`Response from ${v.response!.reviewer.name}: ${summary.totalAnnotations} annotation(s), ${summary.open} open, disputed claims: ${summary.disputedClaims.join(", ") || "none"}. Reconciliation ${rec.safe ? "safe" : "has conflicts"}.`);
    setState((s) => ({
      exchange: s.exchange,
      provenance: appendProvenanceEvent(s.provenance, {
        type: "responded", at: at(), actor: v.response!.reviewer.name,
        packageId: pkg.packageId, digest: depDigest(pkg), note: `verdict: ${v.response!.verdict}`,
      }),
    }));
  };

  const provenanceProblems = verifyProvenanceChain(provenance, knownPackages);

  return (
    <div>
      <Announcer message={announce} />

      <Panel title="1. Export — build a review package" subtitle="Deterministic, integrity-checked, privacy-scanned before you share it.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="author-name" className="block text-xs text-slate-300">Your name (self-declared — attribution only, not verified identity)</label>
            <input id="author-name" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-100" />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={includeEmail} onChange={(e) => setIncludeEmail(e.target.checked)} />
              Include email (excluded by default)
            </label>
            {includeEmail && (
              <input aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-100" />
            )}
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={scenarioEnabled} onChange={(e) => setScenarioEnabled(e.target.checked)} />
              Include the burst-overload scenario and its results (replayable by the recipient)
            </label>
          </div>
          <div className="space-y-2">
            <Btn onClick={buildAndExport}>Build and export package</Btn>
            {exportedText && (
              <>
                <Btn onClick={() => download("evidence-package.json", exportedText)}>
                  <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden /> Download JSON</span>
                </Btn>
                <label htmlFor="exported-json" className="block text-xs text-slate-300">Exported package (copy or download to share)</label>
                <textarea id="exported-json" readOnly value={exportedText} rows={4}
                  className="w-full rounded-md bg-slate-800 border border-slate-600 p-2 text-[10px] font-mono text-slate-100" />
                <p className="text-[10px] text-slate-400 break-all">
                  {exportedText.length.toLocaleString()} bytes · checksum fnv1a-32 (corruption detection — a checksum is NOT a signature; author authenticity is explicitly unsupported)
                </p>
              </>
            )}
          </div>
        </div>
        {sensitive.length > 0 && (
          <Callout kind="warn">
            <strong>Privacy scan found {sensitive.length} sensitive field(s):</strong>{" "}
            {sensitive.map((f) => `${f.field} (${f.reason})`).join("; ")}
          </Callout>
        )}
        {outboxItems.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-bold text-slate-200 mb-1">Outbox</h4>
            <ul className="text-xs text-slate-300 space-y-1">
              {outboxItems.map((i) => (
                <li key={i.id}>
                  <Send size={11} aria-hidden className="inline mr-1" /> {i.packageId} — {i.status} ({i.actions.length} actions)
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="2. Import — receive a package from another user" subtitle="Validated in isolation: schema, limits, prototype pollution, integrity. Nothing is applied until you approve.">
        <label htmlFor="import-box" className="block text-xs text-slate-300 mb-1">Paste a Datanova evidence package (JSON)</label>
        <textarea id="import-box" value={importText} onChange={(e) => setImportText(e.target.value)} rows={4}
          className="w-full rounded-md bg-slate-800 border border-slate-600 p-2 text-xs font-mono text-slate-100" />
        <div className="flex gap-2 mt-2">
          <Btn onClick={validateImport}><span className="inline-flex items-center gap-1"><ShieldCheck size={12} aria-hidden /> Validate</span></Btn>
          <Btn onClick={receiveValidated} disabled={!verdict?.valid}>Receive into inbox</Btn>
        </div>
        {verdict && (
          <div className="mt-2 text-xs">
            {verdict.valid ? (
              <Callout kind="ok">
                <strong>Valid package.</strong> {verdict.preview!.packageId} by {verdict.preview!.createdBy} —
                {" "}{verdict.preview!.components} components, {verdict.preview!.evidence} evidence artifacts,
                scenario: {verdict.preview!.scenario ? "included" : "absent"}, {verdict.preview!.claims} claims, {verdict.preview!.sources} sources.
              </Callout>
            ) : (
              <Callout kind="bad">
                <strong>Rejected ({verdict.problems.length} problem(s)) — nothing was applied:</strong>
                <ul className="list-disc ml-4 mt-1">
                  {verdict.problems.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Callout>
            )}
          </div>
        )}
        {inboxItems.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <h4 className="text-xs font-bold text-slate-200"><Inbox size={11} aria-hidden className="inline mr-1" />Inbox</h4>
              <label htmlFor="inbox-filter" className="text-[11px] text-slate-400">Filter</label>
              <select id="inbox-filter" value={inboxFilter}
                onChange={(e) => setInboxFilter(e.target.value as "all" | "pending" | "closed")}
                className="rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-[11px] text-slate-100">
                <option value="all">All packages</option>
                <option value="pending">Pending review (received/inspected)</option>
                <option value="closed">Closed (accepted/rejected)</option>
              </select>
            </div>
            <ul className="text-xs text-slate-300 space-y-1">
              {inboxItems.filter((i) =>
                inboxFilter === "all"
                || (inboxFilter === "pending" && (i.status === "received" || i.status === "inspected"))
                || (inboxFilter === "closed" && (i.status === "accepted" || i.status === "rejected")),
              ).map((i) => (
                <li key={i.id} className="border border-slate-700/60 rounded-md p-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span>
                      <strong>{i.packageId}</strong> from {i.package_?.createdBy.name} — status: {i.status}
                    </span>
                    <span className="flex gap-1">
                      {i.status === "received" && <Btn onClick={() => inspectInbox(i.packageId)}>Inspect</Btn>}
                      {i.status === "inspected" && <Btn onClick={() => acceptInbox(i.packageId)}>Accept (staged)</Btn>}
                      {(i.status === "received" || i.status === "inspected") && <Btn onClick={() => rejectInbox(i.packageId)}>Reject</Btn>}
                      <Btn onClick={() => setSelectedInbox(i.packageId)} aria-pressed={selectedInbox === i.packageId}>Review</Btn>
                    </span>
                  </div>
                  {selectedInbox === i.packageId && i.package_ && (
                    <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                      <p>{i.package_.evidence.length} evidence artifacts · {i.package_.claimIds.length} claims · {i.package_.sourceIds.length} sources</p>
                      <p>Replay: {(() => {
                        const r = replayDepScenario(i.package_!);
                        return r.blocked ? `blocked — ${r.blocked}` : r.reproducible ? `reproducible (${r.comparisons.length} expectations match)` : `DIFFERS — ${r.differences[0]}`;
                      })()}</p>
                      <p>Differences vs your workspace architecture: {(() => {
                        try {
                          const d = diffModels(model, parseModel(i.package_!.modelJson));
                          return d.length === 0 ? "none — semantically identical" : d.length + " semantic change(s)";
                        } catch { return "uncomparable — packaged model does not validate"; }
                      })()}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {selectedItem && (
        <Panel title={`3. Review — annotate ${selectedItem.packageId}`} subtitle="Comments attach to specific components or evidence; the received package is never modified.">
          <div className="grid gap-2 md:grid-cols-3 mb-2">
            <label htmlFor="ann-target" className="block text-xs text-slate-300 md:col-span-1">Annotation target</label>
            <input id="ann-target" value={annTarget} onChange={(e) => setAnnTarget(e.target.value)}
              placeholder="component:meta-db or evidence:ev-1"
              className="md:col-span-2 w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs font-mono text-slate-100" />
            <label htmlFor="ann-comment" className="block text-xs text-slate-300 md:col-span-1">Comment</label>
            <input id="ann-comment" value={annComment} onChange={(e) => setAnnComment(e.target.value)}
              className="md:col-span-2 w-full rounded-md bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-100" />
          </div>
          <Btn onClick={annotate} disabled={!annTarget || !annComment}>Add annotation</Btn>
          {selectedItem.annotations.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {selectedItem.annotations.map((a) => (
                <li key={a.id} className="border border-slate-700/60 rounded-md p-2">
                  <span className="font-mono text-[10px] text-slate-400">{a.target}</span> — {a.comment}
                  <span className="ml-2 text-[10px] text-slate-500">{a.status} · {a.responses.length} response(s)</span>
                  {a.status !== "resolved" && (
                    <Btn className="ml-2" onClick={() => setState((s) => ({
                      exchange: resolveAnnotation(s.exchange, a.id, at(), authorName, "addressed"),
                      provenance: s.provenance,
                    }))}>Resolve</Btn>
                  )}
                  {a.status === "resolved" && (
                    <Btn className="ml-2" onClick={() => setState((s) => ({
                      exchange: reopenAnnotation(s.exchange, a.id, at(), authorName, "needs more discussion"),
                      provenance: s.provenance,
                    }))}>Reopen</Btn>
                  )}
                </li>
              ))}
            </ul>
          )}
          {danglingAnnotations(selectedItem).length > 0 && (
            <Callout kind="warn">
              {danglingAnnotations(selectedItem).length} annotation(s) reference targets that do not resolve in this package.
            </Callout>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            <Btn onClick={sendResponse}><span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden /> Export review response</span></Btn>
            <Btn onClick={() => {
              const next = deleteExchangeData(exchange, selectedItem.packageId, { alsoOutboxHistory: false });
              const kept = next.state.items.some((i) => i.packageId === selectedItem.packageId);
              setState((s) => ({ exchange: next.state, provenance: s.provenance }));
              setSelectedInbox("");
              setAnnounce(`Removed ${next.removed ? next.removed.annotations : 0} annotation(s) for ${selectedItem.packageId}${kept ? " (outbox attribution history preserved)" : ""}.`);
            }}><span className="inline-flex items-center gap-1"><Trash2 size={12} aria-hidden /> Delete local review data</span></Btn>
          </div>
        </Panel>
      )}

      <Panel title="4. Author view — import a returned review response" subtitle="Responses are digest-bound: they fail safely if the package changed after review.">
        <label htmlFor="resp-box" className="block text-xs text-slate-300 mb-1">Paste a review response (JSON)</label>
        <textarea id="resp-box" value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3}
          className="w-full rounded-md bg-slate-800 border border-slate-600 p-2 text-xs font-mono text-slate-100" />
        <Btn className="mt-2" onClick={importResponse}>Import response</Btn>
        {responseError && <Callout kind="bad">{responseError}</Callout>}
      </Panel>

      <Panel title="5. Provenance chain" subtitle="Append-only, digest-linked history from authoring to acceptance.">
        {provenance.length === 0 ? (
          <p className="text-xs text-slate-400">No exchange events yet — export or import a package to start the chain.</p>
        ) : (
          <ol className="text-xs text-slate-300 space-y-1 list-decimal ml-4">
            {provenanceTimeline(provenance).map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        )}
        {provenanceProblems.length > 0 && (
          <Callout kind="bad">
            <strong>Chain problems detected:</strong> {provenanceProblems.map((p) => p.problem).join("; ")}
          </Callout>
        )}
      </Panel>
    </div>
  );
};
