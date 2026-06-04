import { describe, expect, it } from 'vitest';
import type { Config } from '../../src/config/types.js';
import { buildRegistry, getSearchProviders } from '../../src/providers/registry.js';

describe('buildRegistry', () => {
  it('returns empty arrays when no providers configured', () => {
    const result = buildRegistry({});
    expect(result.search).toEqual([]);
    expect(result.fetch).toEqual([]);
    expect(result.defaultSearchChannels).toEqual([]);
    expect(result.defaultFetchChannels).toEqual([]);
    expect(result.optInOnly).toEqual([]);
  });

  it('shows only tavily when only TAVILY_API_KEY is set', () => {
    const config: Config = { tavily: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['tavily']);
    expect(result.fetch).toEqual(['tavily']);
    expect(result.defaultSearchChannels).toEqual(['tavily']);
    expect(result.optInOnly).toEqual([]);
  });

  it('tavily + exa + firecrawl: firecrawl is opt-in only in search', () => {
    const config: Config = {
      tavily: { apiKey: 'test-key' },
      exa: { apiKey: 'test-key' },
      firecrawl: { apiKey: 'test-key' },
    };
    const result = buildRegistry(config);
    // firecrawl is searchOptInOnly so excluded from defaultSearchChannels
    expect(result.search).toContain('tavily');
    expect(result.search).toContain('exa');
    expect(result.search).toContain('firecrawl');
    expect(result.defaultSearchChannels).toEqual(['tavily', 'exa']);
    expect(result.optInOnly).toEqual(['firecrawl']);
    // firecrawl is in fetch
    expect(result.fetch).toContain('firecrawl');
    expect(result.fetch).toContain('tavily');
    expect(result.fetch).toContain('exa');
  });

  it('jina is fetch-only', () => {
    const config: Config = { jina: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual([]);
    expect(result.fetch).toEqual(['jina']);
  });

  it('brave is search-only', () => {
    const config: Config = { brave: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['brave']);
    expect(result.fetch).toEqual([]);
  });

  it('defaultFetchChannels prioritizes firecrawl then jina', () => {
    const config: Config = {
      jina: { apiKey: 'test-key' },
      firecrawl: { apiKey: 'test-key' },
      tavily: { apiKey: 'test-key' },
    };
    const result = buildRegistry(config);
    // firecrawl first, jina second, then tavily
    expect(result.defaultFetchChannels[0]).toBe('firecrawl');
    expect(result.defaultFetchChannels[1]).toBe('jina');
    expect(result.defaultFetchChannels).toContain('tavily');
  });

  it('gemini is search-only and default-on when GEMINI_API_KEY set', () => {
    const config: Config = { gemini: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['gemini']);
    expect(result.fetch).toEqual([]);
    expect(result.defaultSearchChannels).toEqual(['gemini']);
    expect(result.optInOnly).not.toContain('gemini');
  });

  it('gemini coexists with other search providers in defaults', () => {
    const config: Config = {
      tavily: { apiKey: 't' },
      exa: { apiKey: 'e' },
      gemini: { apiKey: 'g' },
    };
    const result = buildRegistry(config);
    expect(result.search).toContain('tavily');
    expect(result.search).toContain('exa');
    expect(result.search).toContain('gemini');
    expect(result.defaultSearchChannels).toContain('gemini');
    expect(result.optInOnly).toEqual([]);
  });

  it('getSearchProviders includes a gemini adapter when GEMINI_API_KEY is set', () => {
    const config: Config = {
      tavily: { apiKey: 't' },
      gemini: { apiKey: 'g' },
    };
    const providers = getSearchProviders(config);
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('tavily');
    expect(ids).toContain('gemini');
  });

  it('getSearchProviders omits gemini when not configured', () => {
    const config: Config = { tavily: { apiKey: 't' } };
    const providers = getSearchProviders(config);
    expect(providers.map((p) => p.id)).not.toContain('gemini');
  });
});
