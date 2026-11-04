/**
 * Campaign 07 — Task 02: Operational Evidence Envelope
 *
 * Canonical envelope schema, deterministic hashing, runtime validation,
 * and serialization for all operational observations (traces, metrics,
 * logs, infrastructure, deployment changes, and synthetic benchmarks).
 */

export type SourceType =
  | "trace"
  | "metric"
  | "log"
  | "infrastructure"
  | "deployment"
  | "observation";

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type EvidenceQualityStatus =
  | "valid"
  | "quarantined"
  | "incomplete"
  | "stale"
  | "synthetic";

export interface EvidenceRelationshipRef {
  target: string;
  type: string;
  protocol?: string;
  port?: number;
}

export interface OperationalEvidenceEnvelope {
  schemaVersion: "1.0.0";
  evidenceId: string;
  workspaceId: string;
  sourceSystem: string;
  sourceType: SourceType;
  sourceVersion: string;
  sourceResourceId: string;
  observedTime: string; // ISO 8601
  ingestedTime: string; // ISO 8601
  validityInterval?: {
    start: string;
    end: string;
  };
  serviceIdentity?: string;
  resourceAttributes?: Record<string, string | number | boolean>;
  environment: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  relationshipReferences?: EvidenceRelationshipRef[];
  measurementName?: string;
  measurementValue?: number;
  unit?: string;
  dataClassification: DataClassification;
  integrityHash: string; // SHA-256 hex string
  provenanceReferences: string[];
  qualityStatus: EvidenceQualityStatus;
  rawPayload?: Record<string, unknown>;
}

/** Deterministic canonical JSON serialization (alphabetically sorted keys) */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys
    .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify((obj as Record<string, unknown>)[k])}`);
  return `{${pairs.join(",")}}`;
}

/** Pure deterministic SHA-256 implementation in TypeScript */
export function sha256Sync(str: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  const K: number[] = [];
  const H: number[] = [];

  let primeCounter = 0;
  const isPrime = (n: number) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        H[primeCounter] = ((mathPow(candidate, 1 / 2) * maxWord) | 0) >>> 0;
      }
      K[primeCounter] = ((mathPow(candidate, 1 / 3) * maxWord) | 0) >>> 0;
      primeCounter++;
    }
  }

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const wordIndex = i >> 2;
    words[wordIndex] = (words[wordIndex] | (code << ((3 - (i % 4)) * 8))) >>> 0;
  }

  const endCharIndex = str.length;
  const endWordIndex = endCharIndex >> 2;
  words[endWordIndex] = (words[endWordIndex] | (0x80 << ((3 - (endCharIndex % 4)) * 8))) >>> 0;

  const totalLengthWords = (((str.length + 8) >> 6) + 1) * 16;
  while (words.length < totalLengthWords) {
    words.push(0);
  }
  words[totalLengthWords - 1] = asciiBitLength >>> 0;
  words[totalLengthWords - 2] = Math.floor(asciiBitLength / maxWord) >>> 0;

  const W = new Array<number>(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        W[j] = words[i + j] >>> 0;
      } else {
        const gamma0 = rightRotate(W[j - 15], 7) ^ rightRotate(W[j - 15], 18) ^ (W[j - 15] >>> 3);
        const gamma1 = rightRotate(W[j - 2], 17) ^ rightRotate(W[j - 2], 19) ^ (W[j - 2] >>> 10);
        W[j] = (((W[j - 16] + gamma0) >>> 0) + ((W[j - 7] + gamma1) >>> 0)) >>> 0;
      }

      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const temp1 = (((h + sigma1) >>> 0) + ((ch + K[j]) >>> 0) + W[j]) >>> 0;
      const temp2 = (sigma0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    result += ("00000000" + H[i].toString(16)).slice(-8);
  }
  return result;
}

/** Compute envelope integrity hash over canonical body (omitting the hash field itself) */
export function computeEnvelopeHash(
  envelope: Omit<OperationalEvidenceEnvelope, "integrityHash">
): string {
  const canonical = canonicalJsonStringify(envelope);
  return sha256Sync(canonical);
}

export interface EnvelopeValidationResult {
  valid: boolean;
  errors: string[];
  envelope?: OperationalEvidenceEnvelope;
}

/** Strict validation of an operational evidence envelope */
export function validateEnvelope(data: unknown): EnvelopeValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Envelope must be a non-null object"] };
  }

  const env = data as Partial<OperationalEvidenceEnvelope>;

  if (env.schemaVersion !== "1.0.0") {
    errors.push(`Invalid schemaVersion: expected "1.0.0", got "${env.schemaVersion}"`);
  }
  if (!env.evidenceId || typeof env.evidenceId !== "string" || env.evidenceId.trim() === "") {
    errors.push("Missing or invalid evidenceId");
  }
  if (!env.workspaceId || typeof env.workspaceId !== "string") {
    errors.push("Missing or invalid workspaceId");
  }
  if (!env.sourceSystem || typeof env.sourceSystem !== "string") {
    errors.push("Missing or invalid sourceSystem");
  }
  const validSourceTypes: SourceType[] = [
    "trace",
    "metric",
    "log",
    "infrastructure",
    "deployment",
    "observation",
  ];
  if (!env.sourceType || !validSourceTypes.includes(env.sourceType)) {
    errors.push(`Invalid sourceType: "${env.sourceType}"`);
  }
  if (!env.sourceResourceId || typeof env.sourceResourceId !== "string") {
    errors.push("Missing or invalid sourceResourceId");
  }
  if (!env.observedTime || isNaN(Date.parse(env.observedTime))) {
    errors.push(`Invalid observedTime ISO timestamp: "${env.observedTime}"`);
  }
  if (!env.ingestedTime || isNaN(Date.parse(env.ingestedTime))) {
    errors.push(`Invalid ingestedTime ISO timestamp: "${env.ingestedTime}"`);
  }
  if (!env.environment || typeof env.environment !== "string") {
    errors.push("Missing or invalid environment");
  }
  const validClassifications: DataClassification[] = ["public", "internal", "confidential", "restricted"];
  if (!env.dataClassification || !validClassifications.includes(env.dataClassification)) {
    errors.push(`Invalid dataClassification: "${env.dataClassification}"`);
  }
  const validStatuses: EvidenceQualityStatus[] = ["valid", "quarantined", "incomplete", "stale", "synthetic"];
  if (!env.qualityStatus || !validStatuses.includes(env.qualityStatus)) {
    errors.push(`Invalid qualityStatus: "${env.qualityStatus}"`);
  }
  if (!Array.isArray(env.provenanceReferences)) {
    errors.push("provenanceReferences must be an array of strings");
  }
  if (!env.integrityHash || typeof env.integrityHash !== "string") {
    errors.push("Missing or invalid integrityHash");
  } else {
    // Verify hash integrity
    const { integrityHash, ...body } = env as OperationalEvidenceEnvelope;
    const computed = computeEnvelopeHash(body);
    if (computed !== integrityHash) {
      errors.push(`Integrity hash mismatch: expected ${computed}, got ${integrityHash}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    envelope: errors.length === 0 ? (env as OperationalEvidenceEnvelope) : undefined,
  };
}

/** Factory helper to create a validated OperationalEvidenceEnvelope */
export function createEvidenceEnvelope(
  params: Omit<OperationalEvidenceEnvelope, "schemaVersion" | "integrityHash" | "ingestedTime"> & {
    ingestedTime?: string;
  }
): OperationalEvidenceEnvelope {
  const ingestedTime = params.ingestedTime || new Date().toISOString();
  const partial: Omit<OperationalEvidenceEnvelope, "integrityHash"> = {
    ...params,
    schemaVersion: "1.0.0",
    ingestedTime,
  };
  const integrityHash = computeEnvelopeHash(partial);
  return {
    ...partial,
    integrityHash,
  };
}
