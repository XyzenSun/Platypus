import { isDomainBlacklisted } from '../../config/domain-blacklist.js';
import type { SearchResult } from '../../providers/search-types.js';
import type { ScoringStrategy, ScoringStrategyPostProcessor } from '../scoring-types.js';

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

export class PostProcessScoringStrategy implements ScoringStrategy {
  readonly id: string;

  constructor(
    private readonly inner: ScoringStrategy,
    private readonly options: {
      providerWeights?: Partial<Record<string, number>>;
      domainBlacklist?: ReadonlySet<string>;
    } = {},
  ) {
    this.id = `${inner.id}+post-process`;
  }

  merge(input: Parameters<ScoringStrategy['merge']>[0]): SearchResult[] {
    const merged = this.inner.merge(input);
    const weighted = applyProviderWeights(merged, this.options.providerWeights ?? {});
    const filtered = applyDomainBlacklist(weighted, this.options.domainBlacklist ?? new Set());
    return resort(filtered);
  }
}

export const postProcessResults: ScoringStrategyPostProcessor = (results, options = {}) => {
  const weighted = applyProviderWeights(results, options.providerWeights ?? {});
  const filtered = applyDomainBlacklist(weighted, options.domainBlacklist ?? new Set());
  return resort(filtered);
};
