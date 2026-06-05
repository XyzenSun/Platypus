import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

const originalEnv = process.env;

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadConfig', () => {
  it('reads EXA_BASE_URL when EXA_API_KEY is set', () => {
    process.env = {
      ...originalEnv,
      EXA_API_KEY: 'exa-key',
      EXA_BASE_URL: 'https://proxy.example.com/exa',
    };

    expect(loadConfig().exa).toEqual({
      apiKey: 'exa-key',
      baseUrl: 'https://proxy.example.com/exa',
    });
  });

  it('reads TAVILY_BASE_URL when TAVILY_API_KEY is set', () => {
    process.env = {
      ...originalEnv,
      TAVILY_API_KEY: 'tavily-key',
      TAVILY_BASE_URL: 'https://proxy.example.com/tavily',
    };

    expect(loadConfig().tavily).toEqual({
      apiKey: 'tavily-key',
      baseUrl: 'https://proxy.example.com/tavily',
    });
  });

  it('reads FIRECRAWL_BASE_URL when FIRECRAWL_API_KEY is set', () => {
    process.env = {
      ...originalEnv,
      FIRECRAWL_API_KEY: 'firecrawl-key',
      FIRECRAWL_BASE_URL: 'https://proxy.example.com/firecrawl',
    };

    expect(loadConfig().firecrawl).toEqual({
      apiKey: 'firecrawl-key',
      baseUrl: 'https://proxy.example.com/firecrawl',
    });
  });

  it('reads PARALLEL_BASE_URL when PARALLEL_API_KEY is set', () => {
    process.env = {
      ...originalEnv,
      PARALLEL_API_KEY: 'parallel-key',
      PARALLEL_BASE_URL: 'https://proxy.example.com/parallel',
    };

    expect(loadConfig().parallel).toEqual({
      apiKey: 'parallel-key',
      baseUrl: 'https://proxy.example.com/parallel',
    });
  });
});
