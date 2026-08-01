import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
import type { NormalizedSearchParams } from '../../src/providers/search-types.js';

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
});
