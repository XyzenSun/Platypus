import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DOMAIN_BLACKLIST_URL } from '../../src/config/domain-blacklist.js';
import { loadConfig } from '../../src/config/env.js';

const originalEnv = process.env;

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('loadConfig', () => {
  it('reads EXA_BASE_URL when EXA_API_KEY is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    process.env = {
      ...originalEnv,
      EXA_API_KEY: 'exa-key',
      EXA_BASE_URL: 'https://proxy.example.com/exa',
    };

    expect((await loadConfig()).exa).toEqual({
      apiKey: 'exa-key',
      baseUrl: 'https://proxy.example.com/exa',
    });
  });

  it('reads TAVILY_BASE_URL when TAVILY_API_KEY is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    process.env = {
      ...originalEnv,
      TAVILY_API_KEY: 'tavily-key',
      TAVILY_BASE_URL: 'https://proxy.example.com/tavily',
    };

    expect((await loadConfig()).tavily).toEqual({
      apiKey: 'tavily-key',
      baseUrl: 'https://proxy.example.com/tavily',
    });
  });

  it('reads FIRECRAWL_BASE_URL when FIRECRAWL_API_KEY is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    process.env = {
      ...originalEnv,
      FIRECRAWL_API_KEY: 'firecrawl-key',
      FIRECRAWL_BASE_URL: 'https://proxy.example.com/firecrawl',
    };

    expect((await loadConfig()).firecrawl).toEqual({
      apiKey: 'firecrawl-key',
      baseUrl: 'https://proxy.example.com/firecrawl',
    });
  });

  it('loads default search post-process config when no overrides are set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'example.com\n' });
    vi.stubGlobal('fetch', fetchMock);
    process.env = { ...originalEnv };

    const config = await loadConfig();

    expect(config.searchPostProcess.providerWeights).toEqual({});
    expect(config.searchPostProcess.domainBlacklistUrl).toBe(DEFAULT_DOMAIN_BLACKLIST_URL);
    expect(config.searchPostProcess.domainBlacklist).toEqual(new Set(['example.com']));
  });

  it('reads provider weight and blacklist url overrides from env', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => 'blocked.com\n' }),
    );
    process.env = {
      ...originalEnv,
      SEARCH_PROVIDER_WEIGHTS: 'exa:1.5,gemini:0.5,unknown:7',
      DOMAIN_BLACKLIST_URL: 'https://cdn.example.com/domains.txt',
    };

    const config = await loadConfig();

    expect(config.searchPostProcess.providerWeights).toEqual({ exa: 1.5, gemini: 0.5 });
    expect(config.searchPostProcess.domainBlacklistUrl).toBe('https://cdn.example.com/domains.txt');
    expect(config.searchPostProcess.domainBlacklist).toEqual(new Set(['blocked.com']));
  });
});
