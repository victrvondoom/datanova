/**
 * Campaign 07 — Task 11: Service & Resource Identity Resolution Engine
 *
 * Transparent deterministic matching joining observed service names,
 * Kubernetes deployment labels, infrastructure entities, and canonical
 * architecture nodes without silent misattribution.
 */

export type MatchQuality = "EXACT" | "PROBABLE" | "AMBIGUOUS" | "UNMATCHED";

export interface IdentityMatch {
  runtimeIdentity: string;
  matchedNodeId?: string;
  matchedNodeName?: string;
  quality: MatchQuality;
  confidenceScore: number;
  strategy: "exact_name" | "normalized_name" | "alias_mapping" | "label_match" | "manual_override" | "none";
  rationale: string;
  candidateNodeIds: string[];
}

export class IdentityResolver {
  private manualOverrides: Map<string, string> = new Map(); // runtimeName -> nodeId

  public setManualOverride(runtimeName: string, targetNodeId: string): void {
    this.manualOverrides.set(runtimeName.toLowerCase(), targetNodeId);
  }

  public clearOverride(runtimeName: string): void {
    this.manualOverrides.delete(runtimeName.toLowerCase());
  }

  public getOverrides(): Record<string, string> {
    return Object.fromEntries(this.manualOverrides.entries());
  }

  /** Normalize service identifiers: lowercase, strip common prefixes/suffixes */
  public normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/^(?:prod|stage|dev|k8s|svc|app)[-_\s]/, "")
      .replace(/[-_\s](?:service|deployment|svc|app|pod|v\d+)$/, "")
      .replace(/[^a-z0-9]/g, "");
  }

  /** Resolve a set of runtime service names against declared architectural nodes */
  public resolveAll(
    runtimeNames: string[],
    declaredNodes: Array<{ id: string; name: string; aliases?: string[] }>
  ): Map<string, IdentityMatch> {
    const results = new Map<string, IdentityMatch>();
    for (const name of runtimeNames) {
      results.set(name, this.resolveOne(name, declaredNodes));
    }
    return results;
  }

  /** Resolve one runtime service name */
  public resolveOne(
    runtimeName: string,
    declaredNodes: Array<{ id: string; name: string; aliases?: string[] }>
  ): IdentityMatch {
    const cleanRaw = runtimeName.toLowerCase().trim();

    // 1. Manual user override check
    const manualTarget = this.manualOverrides.get(cleanRaw);
    if (manualTarget) {
      const targetNode = declaredNodes.find((n) => n.id === manualTarget);
      if (targetNode) {
        return {
          runtimeIdentity: runtimeName,
          matchedNodeId: targetNode.id,
          matchedNodeName: targetNode.name,
          quality: "EXACT",
          confidenceScore: 1.0,
          strategy: "manual_override",
          rationale: `Explicit human confirmation mapped "${runtimeName}" to "${targetNode.name}"`,
          candidateNodeIds: [targetNode.id],
        };
      }
    }

    // 2. Exact name match (case-insensitive)
    for (const node of declaredNodes) {
      if (node.name.toLowerCase() === cleanRaw || node.id.toLowerCase() === cleanRaw) {
        return {
          runtimeIdentity: runtimeName,
          matchedNodeId: node.id,
          matchedNodeName: node.name,
          quality: "EXACT",
          confidenceScore: 1.0,
          strategy: "exact_name",
          rationale: `Exact name match between observed "${runtimeName}" and node "${node.name}"`,
          candidateNodeIds: [node.id],
        };
      }
      if (node.aliases?.some((a) => a.toLowerCase() === cleanRaw)) {
        return {
          runtimeIdentity: runtimeName,
          matchedNodeId: node.id,
          matchedNodeName: node.name,
          quality: "EXACT",
          confidenceScore: 1.0,
          strategy: "alias_mapping",
          rationale: `Explicit alias match for "${runtimeName}"`,
          candidateNodeIds: [node.id],
        };
      }
    }

    // 3. Normalized name match
    const normRuntime = this.normalizeName(runtimeName);
    let candidates: Array<{ node: (typeof declaredNodes)[0]; score: number }> = [];

    for (const node of declaredNodes) {
      const normNode = this.normalizeName(node.name);
      if (normNode === normRuntime) {
        candidates.push({ node, score: 0.9 });
      } else if (normNode.includes(normRuntime) || normRuntime.includes(normNode)) {
        candidates.push({ node, score: 0.75 });
      }
    }

    // If there is an exact normalized match, prefer it over substring matches
    const exactNormalized = candidates.filter((c) => c.score === 0.9);
    if (exactNormalized.length > 0) {
      candidates = exactNormalized;
    }

    if (candidates.length === 1) {
      return {
        runtimeIdentity: runtimeName,
        matchedNodeId: candidates[0].node.id,
        matchedNodeName: candidates[0].node.name,
        quality: "PROBABLE",
        confidenceScore: candidates[0].score,
        strategy: "normalized_name",
        rationale: `Normalized name match between "${runtimeName}" and "${candidates[0].node.name}"`,
        candidateNodeIds: [candidates[0].node.id],
      };
    }

    if (candidates.length > 1) {
      return {
        runtimeIdentity: runtimeName,
        quality: "AMBIGUOUS",
        confidenceScore: 0.5,
        strategy: "none",
        rationale: `Multiple architectural candidate nodes match "${runtimeName}": ${candidates.map((c) => c.node.name).join(", ")}`,
        candidateNodeIds: candidates.map((c) => c.node.id),
      };
    }

    return {
      runtimeIdentity: runtimeName,
      quality: "UNMATCHED",
      confidenceScore: 0.0,
      strategy: "none",
      rationale: `No architectural component matched observed runtime service "${runtimeName}"`,
      candidateNodeIds: [],
    };
  }
}
