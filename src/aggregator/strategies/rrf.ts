import { createHash } from 'node:crypto';
import { normalizeUrl } from '../../lib/url.js';
import type { SearchResult } from '../../providers/search-types.js';
import type { ProviderRanked, ScoringStrategy } from '../scoring-types.js';

function getResultIdentity(
  provider: string,
  result: {
    url: string;
    title: string;
    content?: string;
  },
): string {
  if (result.url) {
    return normalizeUrl(result.url);
  }

  const hash = createHash('sha256')
    .update(provider)
    .update('\0')
    .update(result.title || 'null')
    .update('\0')
    .update(result.content || 'null')
    .digest('hex');

  return `missing-url-${provider}-${hash}`;
}

/**
 * Reciprocal Rank Fusion (Cormack et al., SIGIR 2009).
 *
 * score(d) = Σ_provider  1 / (k + rank_p(d))
 *
 * Default k = 60 (paper-recommended; matches Elasticsearch / Azure AI Search / MongoDB $rankFusion).
 *
 * Also performs URL canonicalization-based dedup and content merge:
 *   - title / content: longest non-empty wins
 *   - publishedDate: first non-empty wins
 *   - sources: list of providers that returned the shared identity
 */
export class RrfScoringStrategy implements ScoringStrategy {
  readonly id = 'rrf';

  constructor(private readonly k: number = 60) {}

  merge(input: ProviderRanked): SearchResult[] {
    const merged = new Map<
      string,
      {
        url: string;
        title: string;
        content?: string;
        publishedDate?: string;
        sources: string[];
        rrfScore: number;
      }
    >();

    for (const [provider, results] of input) {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r) continue;
        const identity = getResultIdentity(provider, r);
        const contribution = 1 / (this.k + (i + 1));

        const existing = merged.get(identity);
        if (existing) {
          existing.rrfScore += contribution;
          existing.sources.push(provider);
          if (r.title.length > existing.title.length) existing.title = r.title;
          if (r.content && (!existing.content || r.content.length > existing.content.length)) {
            existing.content = r.content;
          }
          if (!existing.publishedDate && r.publishedDate) existing.publishedDate = r.publishedDate;
        } else {
          merged.set(identity, {
            url: r.url,
            title: r.title,
            content: r.content,
            publishedDate: r.publishedDate,
            sources: [provider],
            rrfScore: contribution,
          });
        }
      }
    }

    const sorted = [...merged.entries()].sort((a, b) => b[1].rrfScore - a[1].rrfScore);

    return sorted.map(([identity, data], idx) => ({
      id: identity,
      url: data.url,
      title: data.title,
      content: data.content,
      publishedDate: data.publishedDate,
      score: data.rrfScore,
      rank: idx + 1,
      sources: data.sources,
    }));
  }
}
