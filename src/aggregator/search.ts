import { ProviderError } from '../lib/errors.js';
import type {
  NormalizedSearchParams,
  RawProviderResult,
  SearchProvider,
  SearchResponse,
} from '../providers/search-types.js';
import type { ScoringStrategy } from './scoring-types.js';
import { GeminiBoostScoringStrategy } from './strategies/gemini-boost.js';

const defaultScoring = new GeminiBoostScoringStrategy();

export async function aggregateSearch(
  params: NormalizedSearchParams,
  providers: SearchProvider[],
  scoring: ScoringStrategy = defaultScoring,
): Promise<SearchResponse> {
  if (providers.length === 0) {
    throw new Error('No search channels available for the given configuration.');
  }

  const settled = await Promise.allSettled(
    providers.map((p) => p.search(params).then((results) => ({ provider: p.id, results }))),
  );

  const providerResults = new Map<string, RawProviderResult[]>();
  const warnings: SearchResponse['warnings'] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      providerResults.set(outcome.value.provider, outcome.value.results);
    } else {
      const err = outcome.reason;
      if (err instanceof ProviderError) {
        if (err.category === 'USER_ERROR') throw err;
        warnings.push({ provider: err.provider, code: err.code, message: err.message });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push({ provider: 'unknown', code: 'UNKNOWN', message: msg });
      }
    }
  }

  // EC-1: when every provider failed, surface ALL_PROVIDERS_FAILED marker
  // alongside the per-provider warnings, instead of silently returning [].
  if (providerResults.size === 0) {
    return { results: [], warnings, error: 'ALL_PROVIDERS_FAILED' };
  }

  const results = scoring.merge(providerResults);
  return { results, warnings };
}
