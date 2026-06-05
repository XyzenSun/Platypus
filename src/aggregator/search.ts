import { ProviderError } from '../lib/errors.js';
import type {
  ProviderSearchParams,
  SearchProvider,
  SearchRequest,
  SearchResponse,
} from '../providers/search-types.js';
import type { ScoringStrategy } from './scoring-types.js';
import { GeminiBoostScoringStrategy } from './strategies/gemini-boost.js';

const defaultScoring = new GeminiBoostScoringStrategy();

function buildProviderParams(request: SearchRequest): ProviderSearchParams {
  return {
    query: request.query,
    hasContent: request.hasContent,
    perChannelMaxResults: request.perChannelMaxResults,
    includeDomains: request.includeDomains,
    excludeDomains: request.excludeDomains,
    publishedAfter: request.publishedAfter,
    publishedBefore: request.publishedBefore,
    topic: request.topic,
    language: request.language,
    region: request.region,
    searchEffort: request.searchEffort,
    timeoutMs: request.timeoutMs,
  };
}

export async function aggregateSearch(
  request: SearchRequest,
  providers: SearchProvider[],
  scoring: ScoringStrategy = defaultScoring,
): Promise<SearchResponse> {
  if (providers.length === 0) {
    throw new Error('No search channels available for the given configuration.');
  }

  const providerParams = buildProviderParams(request);
  const settled = await Promise.allSettled(providers.map((p) => p.search(providerParams)));

  const providerResults = new Map<
    string,
    { url: string; title: string; content?: string; publishedDate?: string }[]
  >();
  const warnings: SearchResponse['warnings'] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      if (Array.isArray(outcome.value)) {
        providerResults.set('unknown', outcome.value);
        continue;
      }
      providerResults.set(outcome.value.provider, outcome.value.results);
      const note = outcome.value.capabilityNote;
      if (
        note &&
        (note.ignoredFields?.length || note.rewrittenFields?.length || note.notes?.length)
      ) {
        const details = [
          note.ignoredFields?.length ? `ignored: ${note.ignoredFields.join(', ')}` : undefined,
          note.rewrittenFields?.length
            ? `rewritten: ${note.rewrittenFields.join(', ')}`
            : undefined,
          note.notes?.length ? note.notes.join('; ') : undefined,
        ]
          .filter(Boolean)
          .join(' | ');
        warnings.push({
          provider: note.provider,
          code: 'CAPABILITY_NOTE',
          message: details,
        });
      }
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

  if (providerResults.size === 0) {
    return { results: [], warnings, error: 'ALL_PROVIDERS_FAILED' };
  }

  const results = scoring.merge(providerResults);
  return { results, warnings };
}
