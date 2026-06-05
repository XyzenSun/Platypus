import { describe, expect, it } from 'vitest';
import type { ProviderRanked, ScoringStrategy } from '../../src/aggregator/scoring-types.js';
import { GeminiBoostScoringStrategy } from '../../src/aggregator/strategies/gemini-boost.js';
import { GEMINI_SUMMARY_URL } from '../../src/providers/gemini.js';
import type { SearchResult } from '../../src/providers/search-types.js';

/**
 * Stub strategy that lets a test inject the exact list of pre-scored results
 * the GeminiBoost wrapper will see. We avoid going through real RRF math so
 * the test asserts only the boost behaviour, not the RRF formula.
 */
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

describe('GeminiBoostScoringStrategy', () => {
  it('returns inner output unchanged when no gemini source present', () => {
    const inner = new FixedStrategy([
      result({ url: 'https://a', sources: ['tavily'], score: 0.04, rank: 1 }),
      result({ url: 'https://b', sources: ['exa'], score: 0.02, rank: 2 }),
    ]);
    // FixedStrategy already conforms to ScoringStrategy; we cast it to bypass
    // GeminiBoost's RRF-shaped constructor.
    const boost = new GeminiBoostScoringStrategy(
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      inner as any,
    );
    const out = boost.merge(new Map());
    expect(out).toHaveLength(2);
    expect(out[0]?.score).toBe(0.04);
    expect(out[1]?.score).toBe(0.02);
  });

  it('sets gemini score to 0.5 when gemini is the only source', () => {
    const inner = new FixedStrategy([
      result({
        url: GEMINI_SUMMARY_URL,
        sources: ['gemini'],
        score: 1 / 61,
        rank: 1,
      }),
    ]);
    const boost = new GeminiBoostScoringStrategy(
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      inner as any,
    );
    const out = boost.merge(new Map());
    expect(out).toHaveLength(1);
    expect(out[0]?.score).toBe(0.5);
    expect(out[0]?.rank).toBe(1);
    expect(out[0]?.sources).toEqual(['gemini']);
  });

  it('sets gemini score to mean(otherScores) when other providers exist', () => {
    const inner = new FixedStrategy([
      result({ url: 'https://a', sources: ['tavily'], score: 0.04, rank: 1 }),
      result({ url: 'https://b', sources: ['exa'], score: 0.02, rank: 2 }),
      result({
        url: GEMINI_SUMMARY_URL,
        sources: ['gemini'],
        score: 1 / 61,
        rank: 3,
      }),
    ]);
    const boost = new GeminiBoostScoringStrategy(
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      inner as any,
    );
    const out = boost.merge(new Map());
    expect(out).toHaveLength(3);
    const gemini = out.find((r) => r.sources[0] === 'gemini');
    expect(gemini?.score).toBeCloseTo(0.03, 10);
  });

  it('re-sorts and re-ranks after recomputing the gemini score', () => {
    const inner = new FixedStrategy([
      result({ url: 'https://a', sources: ['tavily'], score: 0.04, rank: 1 }),
      result({ url: 'https://b', sources: ['exa'], score: 0.02, rank: 2 }),
      result({
        url: GEMINI_SUMMARY_URL,
        sources: ['gemini'],
        score: 1 / 61,
        rank: 3,
      }),
    ]);
    const boost = new GeminiBoostScoringStrategy(
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      inner as any,
    );
    const out = boost.merge(new Map());

    // 0.04 > 0.03 (gemini=mean) > 0.02 → tavily, gemini, exa
    expect(out.map((r) => r.sources[0])).toEqual(['tavily', 'gemini', 'exa']);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('does not modify gemini score when sources contains gemini plus another provider', () => {
    // Edge case: if a result has sources=['gemini', 'tavily'] (would only happen
    // if Gemini ever returned a real URL that another provider also returned),
    // we treat it as a multi-source organic result and leave it alone.
    const inner = new FixedStrategy([
      result({
        url: 'https://shared.example.com',
        sources: ['gemini', 'tavily'],
        score: 0.05,
        rank: 1,
      }),
    ]);
    const boost = new GeminiBoostScoringStrategy(
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      inner as any,
    );
    const out = boost.merge(new Map());
    expect(out[0]?.score).toBe(0.05);
  });
});
