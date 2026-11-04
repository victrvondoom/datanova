/**
 * Campaign 07 — Task 14 & 15: Drift Taxonomy, Severity Engine & Triage Workflow
 *
 * Manages the drift inbox, triage states, remediation decisions, and
 * links drift findings directly to architectural reconciliation actions.
 */

import type { ReconciliationRecord, DriftClassification, DriftSeverity } from "./reconciliation";

export interface DriftTriageAction {
  recordId: string;
  action: "acknowledge" | "investigate" | "assign" | "resolve" | "reject" | "accept_as_intended";
  actor: string;
  rationale: string;
  assignee?: string;
  timestampIso: string;
}

export class DriftManager {
  private records: Map<string, ReconciliationRecord> = new Map();
  private auditLog: DriftTriageAction[] = [];

  constructor(initialRecords: ReconciliationRecord[] = []) {
    this.setRecords(initialRecords);
  }

  public setRecords(records: ReconciliationRecord[]): void {
    this.records.clear();
    for (const r of records) {
      this.records.set(r.id, { ...r });
    }
  }

  public getRecords(): ReconciliationRecord[] {
    return Array.from(this.records.values());
  }

  public getRecord(id: string): ReconciliationRecord | undefined {
    return this.records.get(id);
  }

  public applyAction(action: Omit<DriftTriageAction, "timestampIso">): ReconciliationRecord {
    const rec = this.records.get(action.recordId);
    if (!rec) {
      throw new Error(`Drift record "${action.recordId}" not found`);
    }

    const timestampIso = new Date().toISOString();
    const triageAction: DriftTriageAction = {
      ...action,
      timestampIso,
    };
    this.auditLog.push(triageAction);

    switch (action.action) {
      case "acknowledge":
        rec.humanReviewStatus = "acknowledged";
        break;
      case "investigate":
        rec.humanReviewStatus = "investigating";
        break;
      case "assign":
        rec.humanReviewStatus = "investigating";
        break;
      case "resolve":
        rec.humanReviewStatus = "resolved";
        break;
      case "reject":
        rec.humanReviewStatus = "rejected";
        break;
      case "accept_as_intended":
        rec.humanReviewStatus = "accepted_as_intended";
        break;
    }

    rec.resolutionNote = `[${triageAction.action.toUpperCase()}] by ${triageAction.actor} at ${timestampIso}: ${triageAction.rationale}`;
    return { ...rec };
  }

  public filter(options: {
    severity?: DriftSeverity;
    classification?: DriftClassification;
    status?: ReconciliationRecord["humanReviewStatus"];
    search?: string;
  }): ReconciliationRecord[] {
    return Array.from(this.records.values()).filter((r) => {
      if (options.severity && r.severity !== options.severity) return false;
      if (options.classification && r.driftClassification !== options.classification) return false;
      if (options.status && r.humanReviewStatus !== options.status) return false;
      if (options.search) {
        const query = options.search.toLowerCase();
        const matches =
          r.sourceService.toLowerCase().includes(query) ||
          (r.targetService && r.targetService.toLowerCase().includes(query)) ||
          r.severityRationale.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }

  public getSummaryStats(): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unreviewed: number;
    resolved: number;
  } {
    const list = Array.from(this.records.values());
    return {
      total: list.length,
      critical: list.filter((r) => r.severity === "critical").length,
      high: list.filter((r) => r.severity === "high").length,
      medium: list.filter((r) => r.severity === "medium").length,
      low: list.filter((r) => r.severity === "low" || r.severity === "info").length,
      unreviewed: list.filter((r) => r.humanReviewStatus === "unreviewed").length,
      resolved: list.filter((r) => r.humanReviewStatus === "resolved" || r.humanReviewStatus === "accepted_as_intended").length,
    };
  }

  public getAuditLog(): DriftTriageAction[] {
    return [...this.auditLog];
  }
}
