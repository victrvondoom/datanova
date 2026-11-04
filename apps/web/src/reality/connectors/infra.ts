/**
 * Campaign 07 — Task 10: Infrastructure & Deployment Artifact Ingestion
 *
 * Ingests Kubernetes manifests (Deployments, Services, StatefulSets),
 * Docker Compose configurations, and Terraform Plan JSON exports,
 * extracting configured resource identities and declared dependencies.
 */

import { createEvidenceEnvelope, type OperationalEvidenceEnvelope } from "../envelope";
import type { ConfiguredGraph, OperationalNode, OperationalEdge } from "../models";
import type { RealityConnector, IngestionContext, IngestionResult } from "./registry";

export interface ConfiguredResource {
  id: string;
  kind: "deployment" | "service" | "statefulset" | "database" | "queue" | "container" | "terraform_resource";
  name: string;
  namespace?: string;
  image?: string;
  replicas?: number;
  ports: number[];
  environmentVariables: Record<string, string>;
  dependencies: Array<{ targetName: string; relationship: string; port?: number }>;
  labels: Record<string, string>;
}

export class InfrastructureConnector implements RealityConnector {
  public readonly id = "infrastructure-manifests";
  public readonly name = "Infrastructure Manifests (K8s, Docker Compose, Terraform)";
  public readonly version = "1.0.0";
  public readonly supportedFormats = ["application/x-yaml", "text/yaml", "application/json"];
  public readonly capabilities = {
    canStream: false,
    canBatch: true,
    supportsIncremental: false,
    readOnly: true as const,
  };

  public parse(content: string, context: IngestionContext): IngestionResult {
    const trimmed = content.trim();
    let resources: ConfiguredResource[] = [];
    const errors: Array<{ code: string; message: string }> = [];

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // JSON: could be Terraform plan JSON or structured K8s JSON
      try {
        const json = JSON.parse(trimmed);
        resources = this.parseJsonArtifact(json);
      } catch (err) {
        errors.push({ code: "JSON_PARSE_ERROR", message: String(err) });
      }
    } else {
      // YAML or multi-document YAML
      try {
        resources = this.parseYamlArtifact(trimmed);
      } catch (err) {
        errors.push({ code: "YAML_PARSE_ERROR", message: String(err) });
      }
    }

    const envelopes: OperationalEvidenceEnvelope[] = [];
    const nowIso = new Date().toISOString();

    for (const res of resources) {
      const relRefs = res.dependencies.map((d) => ({
        target: d.targetName,
        type: d.relationship,
        port: d.port,
      }));

      const env = createEvidenceEnvelope({
        evidenceId: `infra-${res.kind}-${res.name}`,
        workspaceId: context.workspaceId,
        sourceSystem: "infrastructure-manifests",
        sourceType: "infrastructure",
        sourceVersion: "1.0.0",
        sourceResourceId: `${res.namespace ? `${res.namespace}/` : ""}${res.name}`,
        observedTime: nowIso,
        serviceIdentity: res.name,
        environment: context.environment,
        relationshipReferences: relRefs,
        dataClassification: context.classification || "internal",
        provenanceReferences: [`manifest:${res.kind}:${res.name}`],
        qualityStatus: context.isSynthetic ? "synthetic" : "valid",
        resourceAttributes: {
          "infra.kind": res.kind,
          "infra.name": res.name,
          ...(res.namespace ? { "infra.namespace": res.namespace } : {}),
          ...(res.image ? { "infra.image": res.image } : {}),
          ...(res.replicas !== undefined ? { "infra.replicas": res.replicas } : {}),
          ...res.labels,
        },
        rawPayload: {
          kind: res.kind,
          name: res.name,
          ports: res.ports,
          dependencies: res.dependencies,
        },
      });
      envelopes.push(env);
    }

    return {
      connectorId: this.id,
      sourceSystem: "infrastructure-manifests",
      itemsProcessed: resources.length,
      itemsIngested: envelopes.length,
      itemsQuarantined: errors.length,
      envelopes,
      errors,
      health: {
        status: errors.length > 0 ? "degraded" : "healthy",
        latencyMs: 0,
        lastIngestion: nowIso,
      },
    };
  }

  public toConfiguredGraph(resources: ConfiguredResource[], sourceManifests: string[] = []): ConfiguredGraph {
    const nodes: OperationalNode[] = resources.map((r) => ({
      id: `cfg-${r.name}`,
      name: r.name,
      kind: r.kind === "database" ? "database"
        : r.kind === "queue" ? "queue"
        : r.kind === "service" || r.kind === "deployment" ? "service"
        : "pod",
      environment: "production",
      zone: r.namespace || "default",
      metadata: {
        replicas: r.replicas || 1,
        image: r.image || "",
        kind: r.kind,
      },
      provenance: {
        sourceSystem: "infrastructure-manifests",
        sourceType: "kubernetes-or-compose",
        sourceResourceId: r.name,
        evidenceIds: [`infra-${r.kind}-${r.name}`],
        observedAt: new Date().toISOString(),
        confidence: "CONFIRMED",
      },
    }));

    const edges: OperationalEdge[] = [];
    let edgeIdx = 1;
    for (const r of resources) {
      for (const dep of r.dependencies) {
        edges.push({
          id: `cfg-edge-${edgeIdx++}`,
          sourceId: `cfg-${r.name}`,
          targetId: `cfg-${dep.targetName}`,
          relationshipType: "CONFIGURED_DEPENDENCY",
          confidence: "CONFIRMED",
          port: dep.port,
          evidenceIds: [`infra-${r.kind}-${r.name}`],
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
          metadata: {
            relationship: dep.relationship,
          },
        });
      }
    }

    return {
      view: "CONFIGURED",
      sourceManifests,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };
  }

  private parseJsonArtifact(json: unknown): ConfiguredResource[] {
    const results: ConfiguredResource[] = [];
    if (!json || typeof json !== "object") return results;

    // Terraform Plan JSON format check
    if ("resource_changes" in json && Array.isArray((json as Record<string, unknown>).resource_changes)) {
      const changes = (json as Record<string, unknown>).resource_changes as Array<Record<string, unknown>>;
      for (const rc of changes) {
        const type = String(rc.type || "resource");
        const name = String(rc.name || "unnamed");
        const change = (rc.change as Record<string, unknown>) || {};
        const after = (change.after as Record<string, unknown>) || {};

        results.push({
          id: String(rc.address || `${type}.${name}`),
          kind: type.includes("db") || type.includes("postgres") || type.includes("rds") ? "database"
            : type.includes("queue") || type.includes("sqs") ? "queue"
            : "terraform_resource",
          name,
          ports: after.port ? [Number(after.port)] : [],
          environmentVariables: {},
          dependencies: [],
          labels: { "terraform.type": type },
        });
      }
      return results;
    }

    return results;
  }

  private parseYamlArtifact(yamlText: string): ConfiguredResource[] {
    const results: ConfiguredResource[] = [];
    // Split multi-document YAML on "---"
    const docs = yamlText.split(/^---$/m);

    for (const doc of docs) {
      const trimmed = doc.trim();
      if (!trimmed) continue;

      const kindMatch = trimmed.match(/^kind:\s*([A-Za-z0-9_-]+)/m);
      const nameMatch = trimmed.match(/metadata:\s*\n(?:\s+.*\n)*?\s+name:\s*([A-Za-z0-9_-]+)/m);
      const imageMatch = trimmed.match(/image:\s*([^\s]+)/m);
      const replicasMatch = trimmed.match(/replicas:\s*(\d+)/m);

      if (kindMatch && nameMatch) {
        const rawKind = kindMatch[1].toLowerCase();
        const name = nameMatch[1];
        const image = imageMatch ? imageMatch[1] : undefined;
        const replicas = replicasMatch ? parseInt(replicasMatch[1], 10) : 1;

        // Extract dependencies from environment variables like HOST/URL
        const deps: Array<{ targetName: string; relationship: string; port?: number }> = [];
        const envMatches = trimmed.matchAll(/name:\s*([A-Z0-9_]+)\s*\n\s+value:\s*["']?([^"'\n]+)["']?/g);
        for (const em of envMatches) {
          const varName = em[1];
          const varVal = em[2];
          if (varName.includes("HOST") || varName.includes("URL") || varName.includes("ADDR")) {
            const hostMatch = varVal.match(/(?:https?:\/\/)?([a-zA-Z0-9_-]+)(?::(\d+))?/);
            if (hostMatch && hostMatch[1] !== name && !hostMatch[1].includes("localhost")) {
              deps.push({
                targetName: hostMatch[1],
                relationship: "ENV_HOST_REFERENCE",
                port: hostMatch[2] ? parseInt(hostMatch[2], 10) : undefined,
              });
            }
          }
        }

        results.push({
          id: `${rawKind}-${name}`,
          kind: rawKind === "deployment" || rawKind === "statefulset" ? "deployment"
            : rawKind === "service" ? "service"
            : "container",
          name,
          image,
          replicas,
          ports: [],
          environmentVariables: {},
          dependencies: deps,
          labels: { "k8s.kind": kindMatch[1] },
        });
      } else {
        // Simple Docker Compose service block parser: "services:\n  servicename:"
        const serviceMatches = trimmed.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm);
        for (const sm of serviceMatches) {
          const serviceName = sm[1];
          if (serviceName !== "services" && serviceName !== "networks" && serviceName !== "volumes") {
            results.push({
              id: `compose-${serviceName}`,
              kind: serviceName.includes("db") || serviceName.includes("postgres") ? "database"
                : serviceName.includes("queue") || serviceName.includes("mq") ? "queue"
                : "service",
              name: serviceName,
              ports: [],
              environmentVariables: {},
              dependencies: [],
              labels: { "compose.service": serviceName },
            });
          }
        }
      }
    }

    return results;
  }
}
