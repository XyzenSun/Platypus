import { describe, expect, it } from 'vitest';
import { rrfMerge } from '../../src/aggregator/rrf.js';
import type { RawProviderResult } from '../../src/providers/search-types.js';

const r = (url: string, title = 'T', snippet = 'S'): RawProviderResult => ({
  url,
  title,
  snippet,
});

describe('rrfMerge', () => {
  it('returns empty array for empty input', () => {
    expect(rrfMerge(new Map())).toEqual([]);
  });

  it('assigns rank 1 to top result', () => {
    const map = new Map([['tavily', [r('https://a.com'), r('https://b.com')]]]);
    const results = rrfMerge(map);
    expect(results[0]?.rank).toBe(1);
    expect(results[1]?.rank).toBe(2);
  });

  it('computes RRF score correctly (k=60, single provider rank 1)', () => {
    const map = new Map([['exa', [r('https://x.com')]]]);
    const [result] = rrfMerge(map);
    expect(result?.score).toBeCloseTo(1 / 61, 10);
  });

  it('boosts URL appearing in two providers', () => {
    const url = 'https://example.com/page';
    const map = new Map<string, RawProviderResult[]>([
      ['tavily', [r(url), r('https://other.com')]],
      ['exa', [r(url)]],
    ]);
    const results = rrfMerge(map);
    const shared = results.find((r) => r.sources.length === 2);
    expect(shared).toBeDefined();
    expect(shared?.sources).toContain('tavily');
    expect(shared?.sources).toContain('exa');
    // shared URL score > single-provider score
    const single = results.find((r) => r.sources.length === 1);
    expect(shared?.score).toBeGreaterThan(single?.score);
  });

  it('deduplicates URLs by canonical form', () => {
    const map = new Map<string, RawProviderResult[]>([
      ['tavily', [r('http://www.example.com/page/')]],
      ['exa', [r('https://example.com/page')]],
    ]);
    const results = rrfMerge(map);
    expect(results).toHaveLength(1);
    expect(results[0]?.sources).toHaveLength(2);
  });

  it('sorts results by score descending', () => {
    const map = new Map<string, RawProviderResult[]>([
      ['tavily', [r('https://a.com'), r('https://b.com'), r('https://c.com')]],
      ['exa', [r('https://c.com'), r('https://b.com'), r('https://a.com')]],
    ]);
    const results = rrfMerge(map);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]?.score).toBeGreaterThanOrEqual(results[i + 1]?.score);
    }
  });
});
