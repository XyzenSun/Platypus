import { describe, expect, it } from 'vitest';
import type { Config } from '../../src/config/types.js';
import {
  buildRegistry,
  getFetchProviders,
  getSearchProviders,
} from '../../src/providers/registry.js';

describe('buildRegistry', () => {
  it('returns empty arrays when no providers configured', () => {
    const result = buildRegistry({});
    expect(result.search).toEqual([]);
    expect(result.fetch).toEqual([]);
  });

  it('shows only tavily when only TAVILY_API_KEY is set', () => {
    const config: Config = { tavily: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['tavily']);
    expect(result.fetch).toEqual(['tavily']);
  });

  it('includes firecrawl in search when configured', () => {
    const config: Config = {
      tavily: { apiKey: 'test-key' },
      exa: { apiKey: 'test-key' },
      firecrawl: { apiKey: 'test-key' },
    };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['tavily', 'exa', 'firecrawl']);
    expect(result.fetch).toEqual(['tavily', 'exa', 'firecrawl']);
  });

  it('jina is search and fetch when configured', () => {
    const config: Config = { jina: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['jina']);
    expect(result.fetch).toEqual(['jina']);
  });

  it('brave is search-only', () => {
    const config: Config = { brave: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['brave']);
    expect(result.fetch).toEqual([]);
  });

  it('gemini is search-only when GEMINI_API_KEY set', () => {
    const config: Config = { gemini: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['gemini']);
    expect(result.fetch).toEqual([]);
  });

  it('gemini coexists with other search providers', () => {
    const config: Config = {
      tavily: { apiKey: 't' },
      exa: { apiKey: 'e' },
      gemini: { apiKey: 'g' },
    };
    const result = buildRegistry(config);
    expect(result.search).toEqual(['tavily', 'exa', 'gemini']);
    expect(result.fetch).toEqual(['tavily', 'exa']);
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

  it('getSearchProviders includes tavily and exa when baseUrl is configured', () => {
    const config: Config = {
      tavily: { apiKey: 't', baseUrl: 'https://proxy.example.com/tavily' },
      exa: { apiKey: 'e', baseUrl: 'https://proxy.example.com/exa' },
    };
    const providers = getSearchProviders(config);
    expect(providers.map((p) => p.id)).toEqual(['tavily', 'exa']);
  });

  it('getSearchProviders includes firecrawl when baseUrl is configured', () => {
    const config: Config = {
      firecrawl: { apiKey: 'f', baseUrl: 'https://proxy.example.com/firecrawl' },
    };
    const providers = getSearchProviders(config);
    expect(providers.map((p) => p.id)).toEqual(['firecrawl']);
  });

  it('getFetchProviders includes tavily and exa when baseUrl is configured', () => {
    const config: Config = {
      tavily: { apiKey: 't', baseUrl: 'https://proxy.example.com/tavily' },
      exa: { apiKey: 'e', baseUrl: 'https://proxy.example.com/exa' },
    };
    const providers = getFetchProviders(config);
    expect(providers.map((p) => p.id)).toEqual(['tavily', 'exa']);
  });
});
