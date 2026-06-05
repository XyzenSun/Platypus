import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
import type { NormalizedFetchParams } from '../../src/providers/fetch-types.js';
import type { NormalizedSearchParams } from '../../src/providers/search-types.js';
import { TavilyFetchAdapter } from '../../src/providers/tavily-fetch.js';

const searchParams: NormalizedSearchParams = {
  query: 'claude code',
  mode: 'default',
  hasContent: false,
  perChannelMaxResults: 5,
  topic: 'general',
  searchDepth: 'balanced',
  includeImages: false,
  timeoutMs: 1000,
};

const fetchParams: NormalizedFetchParams = {
  urls: ['https://example.com'],
  format: 'markdown',
  timeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('provider baseUrl overrides', () => {
  it('uses default Exa search URL when baseUrl is not set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ExaSearchAdapter('exa-key').search(searchParams);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.exa.ai/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom Exa search baseUrl and trims trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ExaSearchAdapter('exa-key', 'https://proxy.example.com/exa/').search(searchParams);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.com/exa/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom Tavily fetch baseUrl and trims trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ url: 'https://example.com', raw_content: 'hello' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new TavilyFetchAdapter('tavily-key', 'https://proxy.example.com/tavily/').fetch(
      'https://example.com',
      fetchParams,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.com/tavily/extract',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
