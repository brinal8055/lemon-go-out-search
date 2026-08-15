import {
  EMBEDDING_DIMENSION,
  EmbeddingRequestError,
  validateEmbeddingVector,
} from '../../../packages/embedding/src/voyage-client.ts';
import type { TaxonomyRecognition } from './semantic-taxonomy.ts';

export const SEMANTIC_CONFIG_VERSION = 'sem-01-query-v1';
export const SEMANTIC_QUERY_TEMPLATE_VERSION = 'semantic-query-template-v1';
export const SEMANTIC_TIMEOUT_MS = 700;
export const SEMANTIC_CANDIDATE_CAP = 30;
export const CIRCUIT_FAILURE_THRESHOLD = 3;
export const CIRCUIT_OPEN_MS = 30_000;

const BROAD_TERMS = [
  'things to do', 'what to do', 'something to do', 'places to go',
  'saker att göra', 'vad kan man göra', 'något att göra', 'ställen att gå',
];
const OCCASION_TERMS = [
  'date night', 'family outing', 'with friends', 'birthday', 'celebrate',
  'dejt', 'familjeutflykt', 'med vänner', 'födelsedag', 'fira',
];
const CONSTRAINT_TERMS = [
  'nearby', 'near me', 'within', 'outdoor', 'open now',
  'i närheten', 'nära mig', 'inom', 'utomhus', 'öppet nu',
];

export type ShouldEmbedReason =
  | 'SEMANTIC_DISABLED'
  | 'CIRCUIT_OPEN'
  | 'EMPTY_QUERY'
  | 'TIME_ONLY'
  | 'TAXONOMY_ONLY'
  | 'CONSERVATIVE_KNOWN_ITEM'
  | 'BROAD_DISCOVERY'
  | 'OCCASION_INTENT'
  | 'MIXED_CONSTRAINTS'
  | 'UNCERTAIN_MULTI_TOKEN';

export type ShouldEmbedInput = {
  normalizedQuery: string;
  semanticEnabled: boolean;
  circuitOpen?: boolean;
  recognizedTaxonomyOnly?: boolean;
  hasTime?: boolean;
  hasTaxonomyConstraint?: boolean;
  hasLocationConstraint?: boolean;
};

export type SemanticFailure = {
  reason: 'TIMEOUT' | 'RATE_LIMIT' | 'PROVIDER_5XX' | 'INVALID_VECTOR'
    | 'INVALID_RESPONSE' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_ERROR';
  qualifying: boolean;
};

export function shouldEmbed(input: ShouldEmbedInput): { shouldEmbed: boolean; reason: ShouldEmbedReason } {
  if (!input.semanticEnabled) return { shouldEmbed: false, reason: 'SEMANTIC_DISABLED' };
  if (input.circuitOpen) return { shouldEmbed: false, reason: 'CIRCUIT_OPEN' };
  if (!input.normalizedQuery) {
    return { shouldEmbed: false, reason: input.hasTime ? 'TIME_ONLY' : 'EMPTY_QUERY' };
  }
  if (input.recognizedTaxonomyOnly) return { shouldEmbed: false, reason: 'TAXONOMY_ONLY' };
  if (containsConfiguredTerm(input.normalizedQuery, BROAD_TERMS)) {
    return { shouldEmbed: true, reason: 'BROAD_DISCOVERY' };
  }
  if (containsConfiguredTerm(input.normalizedQuery, OCCASION_TERMS)) {
    return { shouldEmbed: true, reason: 'OCCASION_INTENT' };
  }
  if (input.hasTaxonomyConstraint || input.hasLocationConstraint
    || containsConfiguredTerm(input.normalizedQuery, CONSTRAINT_TERMS)) {
    return { shouldEmbed: true, reason: 'MIXED_CONSTRAINTS' };
  }
  if (input.normalizedQuery.split(' ').length > 4) {
    return { shouldEmbed: true, reason: 'UNCERTAIN_MULTI_TOKEN' };
  }
  return { shouldEmbed: false, reason: 'CONSERVATIVE_KNOWN_ITEM' };
}

export function buildSemanticQueryInput(
  normalizedQuery: string,
  taxonomy: TaxonomyRecognition | { en: string; sv: string } | null,
  time: { start: string; end: string } | undefined,
): string {
  const lines = [`query: ${normalizedQuery}`];
  if (taxonomy) lines.push(`taxonomy: ${taxonomy.en} | ${taxonomy.sv}`);
  if (time) lines.push(`time: ${time.start} / ${time.end}`);
  return lines.join('\n');
}

export function validateQueryVector(value: unknown): number[] {
  return validateEmbeddingVector(value, EMBEDDING_DIMENSION);
}

export function classifySemanticFailure(error: unknown): SemanticFailure {
  if (!(error instanceof EmbeddingRequestError)) {
    return { reason: 'PROVIDER_ERROR', qualifying: false };
  }
  if (error.errorCode === 'PROVIDER_TIMEOUT') return { reason: 'TIMEOUT', qualifying: true };
  if (error.errorCode === 'PROVIDER_RATE_LIMIT') return { reason: 'RATE_LIMIT', qualifying: true };
  if (error.errorCode === 'PROVIDER_5XX') return { reason: 'PROVIDER_5XX', qualifying: true };
  if (['WRONG_DIMENSION', 'ZERO_VECTOR', 'NON_FINITE_VECTOR', 'VECTOR_MISSING'].includes(error.errorCode)) {
    return { reason: 'INVALID_VECTOR', qualifying: true };
  }
  if (['INVALID_JSON', 'INVALID_RESPONSE', 'RESPONSE_TOO_LARGE'].includes(error.errorCode)) {
    return { reason: 'INVALID_RESPONSE', qualifying: true };
  }
  if (error.errorCode === 'MISSING_CREDENTIAL') {
    return { reason: 'PROVIDER_UNAVAILABLE', qualifying: false };
  }
  return { reason: 'PROVIDER_ERROR', qualifying: false };
}

export class SemanticCircuitBreaker {
  #consecutiveFailures = 0;
  #openedAt: number | null = null;
  #halfOpenProbe = false;

  isOpen(now: number): boolean {
    return this.#openedAt !== null
      && (now - this.#openedAt < CIRCUIT_OPEN_MS || this.#halfOpenProbe);
  }

  acquire(now: number): boolean {
    if (this.#openedAt === null) return true;
    if (now - this.#openedAt < CIRCUIT_OPEN_MS || this.#halfOpenProbe) return false;
    this.#halfOpenProbe = true;
    return true;
  }

  success(): void {
    this.#consecutiveFailures = 0;
    this.#openedAt = null;
    this.#halfOpenProbe = false;
  }

  failure(now: number, qualifying: boolean): void {
    if (this.#halfOpenProbe) {
      this.#consecutiveFailures = CIRCUIT_FAILURE_THRESHOLD;
      this.#openedAt = now;
      this.#halfOpenProbe = false;
      return;
    }
    if (!qualifying) return;
    this.#consecutiveFailures += 1;
    if (this.#consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      this.#openedAt = now;
    }
  }
}

function containsConfiguredTerm(query: string, terms: string[]): boolean {
  return terms.some((term) => query === term || query.startsWith(`${term} `)
    || query.endsWith(` ${term}`) || query.includes(` ${term} `));
}
