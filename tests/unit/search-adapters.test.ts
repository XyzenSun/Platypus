import { describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
import type { NormalizedSearchParams } from '../../src/providers/search-types.js';
import { TavilySearchAdapter } from '../../src/providers/tavily.js';

const baseParams: NormalizedSearchParams = {
  query: 'platypus',
  mode: 'default',
  hasContent: false,
  perChannelMaxResults: 5,
  topic: 'general',
  searchDepth: 'balanced',
  includeImages: false,
  timeoutMs: 1_000,
};

describe('search adapters empty-url behavior', () => {
  it('filters empty-url Exa results when hasContent=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { url: '', title: 'missing url', text: 'body' },
            { url: 'https://example.com', title: 'kept', text: 'body' },
          ],
        }),
      }),
    );

    const adapter = new ExaSearchAdapter('test-key');
    const results = await adapter.search(baseParams);

    expect(results).toEqual([
      {
        url: 'https://example.com',
        title: 'kept',
        content: undefined,
        publishedDate: undefined,
      },
    ]);
  });

  it('keeps empty-url Exa results when hasContent=true without assigning identity in adapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ url: '', title: 'missing url', text: 'body' }],
        }),
      }),
    );

    const adapter = new ExaSearchAdapter('test-key');
    const results = await adapter.search({ ...baseParams, hasContent: true });

    expect(results).toEqual([
      {
        url: '',
        title: 'missing url',
        content: 'body',
        publishedDate: undefined,
      },
    ]);
  });

  it('filters empty-url Tavily results when hasContent=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { url: '', title: 'missing url', content: 'snippet', raw_content: 'body' },
            { url: 'https://example.com', title: 'kept', content: 'snippet', raw_content: 'body' },
          ],
        }),
      }),
    );

    const adapter = new TavilySearchAdapter('test-key');
    const results = await adapter.search(baseParams);

    expect(results).toEqual([
      {
        url: 'https://example.com',
        title: 'kept',
        content: undefined,
        publishedDate: undefined,
      },
    ]);
  });

  it('keeps empty-url Tavily results when hasContent=true without assigning identity in adapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ url: '', title: 'missing url', content: 'snippet', raw_content: 'body' }],
        }),
      }),
    );

    const adapter = new TavilySearchAdapter('test-key');
    const results = await adapter.search({ ...baseParams, hasContent: true });

    expect(results).toEqual([
      {
        url: '',
        title: 'missing url',
        content: 'body',
        publishedDate: undefined,
      },
    ]);
  });
});
