import { describe, expect, it } from 'vitest';
import type { ProviderRanked, ScoringStrategy } from '../../src/aggregator/scoring-types.js';
import { GeminiBoostScoringStrategy } from '../../src/aggregator/strategies/gemini-boost.js';
import { PostProcessScoringStrategy } from '../../src/aggregator/strategies/post-process.js';
import { GEMINI_SUMMARY_URL } from '../../src/providers/gemini.js';
import type { SearchResult } from '../../src/providers/search-types.js';

class FixedStrategy implements ScoringStrategy {
  readonly id = 'fixed';
  constructor(private readonly fixed: SearchResult[]) {}
  merge(_input: ProviderRanked): SearchResult[] {
    return this.fixed.map((r) => ({ ...r }));
  }
}

const result = (overrides: Partial<SearchResult>): SearchResult => ({
  id: 'x',
  url: 'https://example.com',
  title: 'T',
  score: 0,
  rank: 0,
  sources: ['tavily'],
  ...overrides,
});

describe('PostProcessScoringStrategy', () => {
  it('keeps ordering unchanged when no weights, blacklist, or filters are configured', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://b.example.com', score: 0.02, rank: 2, sources: ['exa'] }),
    ]);

    const out = new PostProcessScoringStrategy(inner).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['a', 'b']);
    expect(out.map((item) => item.rank)).toEqual([1, 2]);
  });

  it('applies provider weights and re-ranks results', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://b.example.com', score: 0.03, rank: 2, sources: ['exa'] }),
    ]);

    const out = new PostProcessScoringStrategy(inner, {
      providerWeights: { exa: 2 },
    }).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['b', 'a']);
    expect(out[0]?.score).toBe(0.06);
    expect(out.map((item) => item.rank)).toEqual([1, 2]);
  });

  it('filters blacklisted domains using parent-domain matching', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://allowed.example.com', score: 0.04, rank: 1 }),
      result({ id: 'b', url: 'https://news.blocked.com/page', score: 0.03, rank: 2 }),
      result({ id: 'c', url: '', score: 0.02, rank: 3 }),
    ]);

    const out = new PostProcessScoringStrategy(inner, {
      domainBlacklist: new Set(['blocked.com']),
    }).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['a', 'c']);
    expect(out.map((item) => item.rank)).toEqual([1, 2]);
  });

  it('filters by minScore after weighting, blacklist filtering, and re-ranking', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://blocked.com/item', score: 0.03, rank: 2, sources: ['exa'] }),
      result({ id: 'c', url: 'https://c.example.com', score: 0.02, rank: 3, sources: ['gemini'] }),
    ]);

    const out = new PostProcessScoringStrategy(inner, {
      providerWeights: { gemini: 3 },
      domainBlacklist: new Set(['blocked.com']),
      minScore: 0.05,
    }).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['c']);
    expect(out[0]?.score).toBe(0.06);
    expect(out[0]?.rank).toBe(1);
  });

  it('filters by maxRank after final re-ranking', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://b.example.com', score: 0.03, rank: 2, sources: ['exa'] }),
      result({ id: 'c', url: 'https://c.example.com', score: 0.02, rank: 3, sources: ['gemini'] }),
    ]);

    const out = new PostProcessScoringStrategy(inner, {
      providerWeights: { gemini: 3 },
      maxRank: 2,
    }).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['c', 'a']);
    expect(out.map((item) => item.rank)).toEqual([1, 2]);
  });

  it('applies minScore and maxRank together on final results', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://b.example.com', score: 0.03, rank: 2, sources: ['exa'] }),
      result({ id: 'c', url: 'https://c.example.com', score: 0.02, rank: 3, sources: ['gemini'] }),
    ]);

    const out = new PostProcessScoringStrategy(inner, {
      providerWeights: { gemini: 3, exa: 2 },
      minScore: 0.05,
      maxRank: 2,
    }).merge(new Map());

    expect(out.map((item) => item.id)).toEqual(['b', 'c']);
    expect(out.map((item) => item.rank)).toEqual([1, 2]);
    expect(out.every((item) => item.score >= 0.05)).toBe(true);
  });

  it('runs after gemini boost so wrappers remain composable', () => {
    const inner = new FixedStrategy([
      result({ id: 'a', url: 'https://a.example.com', score: 0.04, rank: 1, sources: ['tavily'] }),
      result({ id: 'b', url: 'https://b.example.com', score: 0.02, rank: 2, sources: ['exa'] }),
      result({
        id: 'g',
        url: GEMINI_SUMMARY_URL,
        score: 1 / 61,
        rank: 3,
        sources: ['gemini'],
      }),
    ]);

    const out = new PostProcessScoringStrategy(
      new GeminiBoostScoringStrategy(
        // biome-ignore lint/suspicious/noExplicitAny: test stub
        inner as any,
      ),
      { providerWeights: { gemini: 2 } },
    ).merge(new Map());

    expect(out.map((item) => item.sources[0])).toEqual(['gemini', 'tavily', 'exa']);
    expect(out[0]?.score).toBeCloseTo(0.06, 10);
  });
});
