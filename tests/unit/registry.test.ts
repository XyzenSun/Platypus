import { describe, expect, it } from 'vitest';
import type { Config } from '../../src/config/types.js';
import { buildRegistry, getSearchProviders } from '../../src/providers/registry.js';

describe('buildRegistry', () => {
  it('returns empty array when no providers configured', () => {
    const result = buildRegistry({});
    expect(result.providers).toEqual([]);
  });

  it('shows only tavily when only TAVILY_API_KEY is set', () => {
    const config: Config = { tavily: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['tavily']);
  });

  it('includes firecrawl in providers when configured', () => {
    const config: Config = {
      tavily: { apiKey: 'test-key' },
      exa: { apiKey: 'test-key' },
      firecrawl: { apiKey: 'test-key' },
    };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['tavily', 'exa', 'firecrawl']);
  });

  it('jina is listed when configured', () => {
    const config: Config = { jina: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['jina']);
  });

  it('brave is listed when configured', () => {
    const config: Config = { brave: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['brave']);
  });

  it('gemini is listed when GEMINI_API_KEY set', () => {
    const config: Config = { gemini: { apiKey: 'test-key' } };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['gemini']);
  });

  it('gemini coexists with other providers', () => {
    const config: Config = {
      tavily: { apiKey: 't' },
      exa: { apiKey: 'e' },
      gemini: { apiKey: 'g' },
    };
    const result = buildRegistry(config);
    expect(result.providers).toEqual(['tavily', 'exa', 'gemini']);
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
});
