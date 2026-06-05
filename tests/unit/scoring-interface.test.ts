import { describe, expect, it } from 'vitest';
import type { ProviderRanked, ScoringStrategy } from '../../src/aggregator/scoring-types.js';
import { aggregateSearch } from '../../src/aggregator/search.js';
import type {
  RawProviderResult,
  SearchProvider,
  SearchRequest,
  SearchResult,
} from '../../src/providers/search-types.js';

const params: SearchRequest = {
  query: 'foo',
  mode: 'search',
  perChannelMaxResults: 10,
  hasContent: false,
  topic: 'common',
  searchEffort: 'medium',
  timeoutMs: 60000,
};

class StubProvider implements SearchProvider {
  constructor(
    readonly id: string,
    private readonly results: RawProviderResult[],
  ) {}
  async search(): Promise<{ provider: string; results: RawProviderResult[] }> {
    return { provider: this.id, results: this.results };
  }
}

/** Strategy that ignores RRF math and returns providers' first lists in registration order. */
class FifoStrategy implements ScoringStrategy {
  readonly id = 'fifo';
  merge(input: ProviderRanked): SearchResult[] {
    const flat: SearchResult[] = [];
    let rank = 1;
    for (const [provider, list] of input) {
      for (const r of list) {
        flat.push({
          id: r.url,
          url: r.url,
          title: r.title,
          content: r.content,
          publishedDate: r.publishedDate,
          score: 1,
          rank,
          sources: [provider],
        });
        rank++;
      }
    }
    return flat;
  }
}

describe('ScoringStrategy interface', () => {
  it('aggregateSearch defaults to RRF when no strategy passed', async () => {
    const providers = [
      new StubProvider('tavily', [
        { url: 'https://a.com', title: 'A' },
        { url: 'https://b.com', title: 'B' },
      ]),
    ];
    const out = await aggregateSearch(params, providers);
    // RRF: rank 1 score = 1/61 ≈ 0.0164
    expect(out.results[0]?.score).toBeCloseTo(1 / 61, 6);
  });

  it('aggregateSearch uses provided custom strategy (FIFO order, score=1)', async () => {
    const providers: SearchProvider[] = [
      new StubProvider('tavily', [
        { url: 'https://t-1.com', title: 'T1' },
        { url: 'https://t-2.com', title: 'T2' },
      ]),
      new StubProvider('exa', [{ url: 'https://e-1.com', title: 'E1' }]),
    ];
    const out = await aggregateSearch(params, providers, new FifoStrategy());
    // FIFO: tavily list first, then exa list — score is constant 1
    expect(out.results.map((r) => r.url)).toEqual([
      'https://t-1.com',
      'https://t-2.com',
      'https://e-1.com',
    ]);
    for (const r of out.results) expect(r.score).toBe(1);
    expect(out.results[0]?.sources).toEqual(['tavily']);
    expect(out.results[2]?.sources).toEqual(['exa']);
  });
});
