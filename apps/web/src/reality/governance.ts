/**
 * Campaign 07 — Task 05 & Task 37: Ingestion Governance, Quarantine & Redaction
 *
 * Enforces sensitive data protection, ingestion limits, quarantined input isolation,
 * and comprehensive data quality reporting.
 */

import type { OperationalEvidenceEnvelope } from "./envelope";

export interface QuarantinedItem {
  id: string;
  sourceSystem: string;
  sourceType: string;
  quarantinedAt: string;
  reasons: string[];
  rawPayloadSummary: string;
}

export interface DataQualityReport {
  timestamp: string;
  totalEnvelopes: number;
  validEnvelopes: number;
  quarantinedCount: number;
  staleCount: number;
  incompleteCount: number;
  freshnessSeconds: number;
  coveragePercentage: number;
  sourcesHealth: Record<string, { status: "healthy" | "degraded" | "failing"; items: number; errors: number }>;
  recommendations: string[];
}

export class IngestionGovernance {
  private quarantinedItems: QuarantinedItem[] = [];

  // Patterns for redaction
  private readonly bearerRegex = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
  private readonly basicAuthRegex = /Basic\s+[A-Za-z0-9+/=]+/gi;
  private readonly passwordRegex = /(["']?(?:password|passwd|secret|api[_-]?key|token)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi;
  private readonly connStringRegex = /([a-z]+:\/\/[^:]+:)([^@]+)(@.+)/gi;
  private readonly privateKeyRegex = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi;
  private readonly emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  private readonly creditCardRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

  /** Redact sensitive strings, secrets, and PII from raw text */
  public redactText(text: string): string {
    return text
      .replace(this.privateKeyRegex, "[REDACTED_PRIVATE_KEY]")
      .replace(this.bearerRegex, "Bearer [REDACTED]")
      .replace(this.basicAuthRegex, "Basic [REDACTED]")
      .replace(this.connStringRegex, "$1[REDACTED]$3")
      .replace(this.passwordRegex, "$1[REDACTED]$3")
      .replace(this.creditCardRegex, "[REDACTED_CARD]")
      .replace(this.emailRegex, "[REDACTED_EMAIL]");
  }

  /** Recursively redact sensitive values in objects */
  public redactObject<T>(obj: T): T {
    if (typeof obj === "string") {
      return this.redactText(obj) as unknown as T;
    }
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("authorization") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = this.redactObject(val);
      }
    }
    return result as T;
  }

  /** Quarantine malformed or suspicious input */
  public quarantine(sourceSystem: string, sourceType: string, payload: unknown, reasons: string[]): QuarantinedItem {
    const rawSummary = typeof payload === "string" ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 200);
    const item: QuarantinedItem = {
      id: `quar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceSystem,
      sourceType,
      quarantinedAt: new Date().toISOString(),
      reasons,
      rawPayloadSummary: this.redactText(rawSummary),
    };
    this.quarantinedItems.push(item);
    return item;
  }

  public getQuarantinedItems(): QuarantinedItem[] {
    return [...this.quarantinedItems];
  }

  /** Generate an inspectable data quality assessment */
  public evaluateQuality(envelopes: OperationalEvidenceEnvelope[], declaredServiceCount = 1): DataQualityReport {
    const now = Date.now();
    let minTime = now;
    let maxTime = 0;
    let staleCount = 0;
    let incompleteCount = 0;
    const sourcesHealth: Record<string, { status: "healthy" | "degraded" | "failing"; items: number; errors: number }> = {};
    const observedServices = new Set<string>();

    for (const env of envelopes) {
      const t = new Date(env.observedTime).getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;

      // Freshness: older than 24 hours considered stale
      if (now - t > 24 * 3600 * 1000) {
        staleCount++;
      }

      if (!env.serviceIdentity || !env.traceId) {
        incompleteCount++;
      }

      if (env.serviceIdentity) {
        observedServices.add(env.serviceIdentity);
      }

      if (!sourcesHealth[env.sourceSystem]) {
        sourcesHealth[env.sourceSystem] = { status: "healthy", items: 0, errors: 0 };
      }
      sourcesHealth[env.sourceSystem].items++;
      if (env.qualityStatus === "incomplete" || env.qualityStatus === "stale") {
        sourcesHealth[env.sourceSystem].errors++;
      }
    }

    // Determine health of each source
    for (const s of Object.keys(sourcesHealth)) {
      const src = sourcesHealth[s];
      if (src.errors > src.items * 0.5) {
        src.status = "failing";
      } else if (src.errors > src.items * 0.1) {
        src.status = "degraded";
      }
    }

    const freshnessSeconds = maxTime > 0 ? Math.floor((now - maxTime) / 1000) : 0;
    const coveragePercentage = declaredServiceCount > 0
      ? Math.min(100, Math.round((observedServices.size / declaredServiceCount) * 100))
      : 100;

    const recommendations: string[] = [];
    if (this.quarantinedItems.length > 0) {
      recommendations.push(`Review ${this.quarantinedItems.length} quarantined payload(s) for malformed syntax.`);
    }
    if (staleCount > 0) {
      recommendations.push(`${staleCount} telemetry sample(s) are older than 24h. Update live or fixture feeds.`);
    }
    if (coveragePercentage < 80) {
      recommendations.push(`Telemetry coverage is ${coveragePercentage}%. Missing traces for declared components.`);
    }

    return {
      timestamp: new Date().toISOString(),
      totalEnvelopes: envelopes.length,
      validEnvelopes: envelopes.filter((e) => e.qualityStatus === "valid" || e.qualityStatus === "synthetic").length,
      quarantinedCount: this.quarantinedItems.length,
      staleCount,
      incompleteCount,
      freshnessSeconds,
      coveragePercentage,
      sourcesHealth,
      recommendations,
    };
  }
}
