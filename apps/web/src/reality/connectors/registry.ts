/**
 * Campaign 07 — Task 06: Extensible Connector Registry
 *
 * Defines typed connector contracts, capability declarations, progress
 * reporting, and standardized ingestion execution.
 */

import type { OperationalEvidenceEnvelope } from "../envelope";

export interface ConnectorCapabilities {
  canStream: boolean;
  canBatch: boolean;
  supportsIncremental: boolean;
  readOnly: true; // Strict non-negotiable security invariant
}

export interface IngestionContext {
  workspaceId: string;
  environment: string;
  classification?: "public" | "internal" | "confidential" | "restricted";
  isSynthetic?: boolean;
}

export interface IngestionResult {
  connectorId: string;
  sourceSystem: string;
  itemsProcessed: number;
  itemsIngested: number;
  itemsQuarantined: number;
  envelopes: OperationalEvidenceEnvelope[];
  errors: Array<{ code: string; message: string; line?: number }>;
  health: {
    status: "healthy" | "degraded" | "failed";
    latencyMs: number;
    lastIngestion: string;
  };
}

export interface RealityConnector {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedFormats: string[];
  readonly capabilities: ConnectorCapabilities;

  parse(content: string, context: IngestionContext): Promise<IngestionResult> | IngestionResult;
}

export class ConnectorRegistry {
  private connectors: Map<string, RealityConnector> = new Map();
  private history: IngestionResult[] = [];

  public register(connector: RealityConnector): void {
    this.connectors.set(connector.id, connector);
  }

  public get(connectorId: string): RealityConnector | undefined {
    return this.connectors.get(connectorId);
  }

  public list(): RealityConnector[] {
    return Array.from(this.connectors.values());
  }

  public async runIngestion(
    connectorId: string,
    content: string,
    context: IngestionContext
  ): Promise<IngestionResult> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector "${connectorId}" not registered.`);
    }

    const start = Date.now();
    try {
      const result = await connector.parse(content, context);
      result.health.latencyMs = Date.now() - start;
      result.health.lastIngestion = new Date().toISOString();
      this.history.unshift(result);
      if (this.history.length > 50) this.history.pop();
      return result;
    } catch (err: unknown) {
      const failedResult: IngestionResult = {
        connectorId,
        sourceSystem: connectorId,
        itemsProcessed: 0,
        itemsIngested: 0,
        itemsQuarantined: 1,
        envelopes: [],
        errors: [{ code: "INGESTION_CRASH", message: err instanceof Error ? err.message : String(err) }],
        health: {
          status: "failed",
          latencyMs: Date.now() - start,
          lastIngestion: new Date().toISOString(),
        },
      };
      this.history.unshift(failedResult);
      return failedResult;
    }
  }

  public getHistory(): IngestionResult[] {
    return [...this.history];
  }
}
