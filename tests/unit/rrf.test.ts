import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { rrfMerge } from '../../src/aggregator/rrf.js';
import type { RawProviderResult } from '../../src/providers/search-types.js';

const r = (url: string, title = 'T', content?: string): RawProviderResult => ({
  url,
  title,
  content,
});

const missingUrlId = (provider: string, title?: string, content?: string) =>
  `missing-url-${provider}-${createHash('sha256')
    .update(provider)
    .update('\0')
    .update(title || 'null')
    .update('\0')
    .update(content || 'null')
    .digest('hex')}`;

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
    expect(results[0]?.id).toBe('https://example.com/page');
  });

  it('keeps dedup key and SearchResult.id aligned for missing urls', () => {
    const map = new Map<string, RawProviderResult[]>([['exa', [r('', 'No URL', 'Body')]]]);
    const [result] = rrfMerge(map);
    expect(result?.id).toBe(missingUrlId('exa', 'No URL', 'Body'));
  });

  it('does not merge distinct empty-url results when hasContent=true', () => {
    const map = new Map<string, RawProviderResult[]>([
      ['exa', [r('', 'First', 'Alpha'), r('', 'Second', 'Beta')]],
    ]);
    const results = rrfMerge(map);
    expect(results).toHaveLength(2);
    expect(new Set(results.map((result) => result.id)).size).toBe(2);
  });

  it('treats missing title and content as null in fallback identity', () => {
    const map = new Map<string, RawProviderResult[]>([['tavily', [r('', '')]]]);
    const [result] = rrfMerge(map);
    expect(result?.id).toBe(missingUrlId('tavily', undefined, undefined));
  });

  it('allows degenerate merge when provider, title, and content are all missing-equivalent', () => {
    const map = new Map<string, RawProviderResult[]>([['exa', [r('', ''), r('', '')]]]);
    const [result] = rrfMerge(map);
    expect(rrfMerge(map)).toHaveLength(1);
    expect(result?.sources).toEqual(['exa', 'exa']);
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

  it('content longest wins across providers', () => {
    const url = 'https://example.com/page';
    const short: RawProviderResult = { url, title: 'T', content: 'short' };
    const long: RawProviderResult = {
      url,
      title: 'T',
      content: 'this is a much longer content body',
    };
    const map1 = new Map([
      ['tavily', [short]],
      ['exa', [long]],
    ]);
    const map2 = new Map([
      ['tavily', [long]],
      ['exa', [short]],
    ]);
    expect(rrfMerge(map1)[0]?.content).toBe('this is a much longer content body');
    expect(rrfMerge(map2)[0]?.content).toBe('this is a much longer content body');
  });

  it('content non-empty preferred over empty', () => {
    const url = 'https://example.com/page';
    const withContent: RawProviderResult = { url, title: 'T', content: 'hello' };
    const withoutContent: RawProviderResult = { url, title: 'T' };
    const map = new Map([
      ['tavily', [withoutContent]],
      ['exa', [withContent]],
    ]);
    expect(rrfMerge(map)[0]?.content).toBe('hello');
  });
});
