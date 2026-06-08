import type { ProviderId } from '../config/types.js';
import type { RawProviderResult, SearchResult } from '../providers/search-types.js';

/**
 * Per-provider ranked results going INTO scoring.
 * Map key = provider id, value = ordered list (index 0 = highest rank from that provider).
 */
export type ProviderRanked = Map<string, RawProviderResult[]>;

export interface ScoringPostProcessOptions {
  providerWeights?: Partial<Record<ProviderId, number>>;
  domainBlacklist?: ReadonlySet<string>;
  minScore?: number;
  maxRank?: number;
}

/**
 * Pluggable scoring algorithm.
 *
 * Implementations are responsible for URL canonicalization + dedup AND content-merge,
 * but should delegate URL canonicalization to `normalizeUrl` from `lib/url.ts`.
 *
 * Returns deduped, score-sorted SearchResult list with `score`, `rank`, `sources` populated.
 */
export interface ScoringStrategy {
  readonly id: string;
  merge(input: ProviderRanked): SearchResult[];
}

export type ScoringStrategyPostProcessor = (
  results: SearchResult[],
  options?: ScoringPostProcessOptions,
) => SearchResult[];
