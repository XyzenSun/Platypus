import { isDomainBlacklisted } from '../../config/domain-blacklist.js';
import type { SearchResult } from '../../providers/search-types.js';
import type {
  ScoringPostProcessOptions,
  ScoringStrategy,
  ScoringStrategyPostProcessor,
} from '../scoring-types.js';

function resort(results: SearchResult[]): SearchResult[] {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted.map((result, index) => ({ ...result, rank: index + 1 }));
}

function getWeight(result: SearchResult, providerWeights: Partial<Record<string, number>>): number {
  return result.sources.reduce((maxWeight, source) => {
    const providerWeight = providerWeights[source];
    return providerWeight === undefined ? maxWeight : Math.max(maxWeight, providerWeight);
  }, 1);
}

function applyProviderWeights(
  results: SearchResult[],
  providerWeights: Partial<Record<string, number>>,
): SearchResult[] {
  if (Object.keys(providerWeights).length === 0) return results;

  return results.map((result) => ({
    ...result,
    score: result.score * getWeight(result, providerWeights),
  }));
}

function applyDomainBlacklist(
  results: SearchResult[],
  domainBlacklist: ReadonlySet<string>,
): SearchResult[] {
  if (domainBlacklist.size === 0) return results;

  return results.filter((result) => {
    if (!result.url) return true;

    try {
      const hostname = new URL(result.url).hostname;
      return !isDomainBlacklisted(hostname, domainBlacklist);
    } catch {
      return true;
    }
  });
}

function applyResultFilters(
  results: SearchResult[],
  options: Pick<ScoringPostProcessOptions, 'minScore' | 'maxRank'>,
): SearchResult[] {
  const { minScore, maxRank } = options;
  if (minScore === undefined && maxRank === undefined) return results;

  return results.filter((result) => {
    if (minScore !== undefined && result.score < minScore) return false;
    if (maxRank !== undefined && result.rank > maxRank) return false;
    return true;
  });
}

function postProcessResultsInternal(
  results: SearchResult[],
  options: ScoringPostProcessOptions = {},
): SearchResult[] {
  const weighted = applyProviderWeights(results, options.providerWeights ?? {});
  const blacklistFiltered = applyDomainBlacklist(weighted, options.domainBlacklist ?? new Set());
  const reranked = resort(blacklistFiltered);
  return applyResultFilters(reranked, options);
}

export class PostProcessScoringStrategy implements ScoringStrategy {
  readonly id: string;

  constructor(
    private readonly inner: ScoringStrategy,
    private readonly options: ScoringPostProcessOptions = {},
  ) {
    this.id = `${inner.id}+post-process`;
  }

  merge(input: Parameters<ScoringStrategy['merge']>[0]): SearchResult[] {
    const merged = this.inner.merge(input);
    return postProcessResultsInternal(merged, this.options);
  }
}

export const postProcessResults: ScoringStrategyPostProcessor = (results, options = {}) => {
  return postProcessResultsInternal(results, options);
};
