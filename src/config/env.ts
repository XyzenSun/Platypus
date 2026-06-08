import { DEFAULT_DOMAIN_BLACKLIST_URL, loadDomainBlacklist } from './domain-blacklist.js';
import type { Config, ProviderId } from './types.js';

const DEFAULT_AI_TIMEOUT_MS = 10_000;

function parseProviderWeights(raw: string | undefined): Partial<Record<ProviderId, number>> {
  if (!raw) return {};

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Partial<Record<ProviderId, number>>>((weights, entry) => {
      const [provider, value] = entry.split(':', 2);
      if (!provider || !value) return weights;

      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return weights;

      if (
        provider === 'tavily' ||
        provider === 'exa' ||
        provider === 'brave' ||
        provider === 'jina' ||
        provider === 'searxng' ||
        provider === 'firecrawl' ||
        provider === 'gemini' ||
        provider === 'ollama'
      ) {
        weights[provider] = parsed;
      }

      return weights;
    }, {});
}

export async function loadConfig(): Promise<Config> {
  const domainBlacklistUrl = process.env.DOMAIN_BLACKLIST_URL ?? DEFAULT_DOMAIN_BLACKLIST_URL;
  const config: Config = {
    searchPostProcess: {
      providerWeights: parseProviderWeights(process.env.SEARCH_PROVIDER_WEIGHTS),
      domainBlacklistUrl,
      domainBlacklist: await loadDomainBlacklist(domainBlacklistUrl),
    },
  };

  if (process.env.TAVILY_API_KEY) {
    config.tavily = {
      apiKey: process.env.TAVILY_API_KEY,
      baseUrl: process.env.TAVILY_BASE_URL,
    };
  }
  if (process.env.EXA_API_KEY) {
    config.exa = {
      apiKey: process.env.EXA_API_KEY,
      baseUrl: process.env.EXA_BASE_URL,
    };
  }
  if (process.env.BRAVE_API_KEY) {
    config.brave = {
      apiKey: process.env.BRAVE_API_KEY,
      baseUrl: process.env.BRAVE_BASE_URL,
    };
  }
  if (process.env.JINA_API_KEY) {
    config.jina = {
      apiKey: process.env.JINA_API_KEY,
      baseUrl: process.env.JINA_BASE_URL,
    };
  }
  if (process.env.SEARXNG_BASE_URL) config.searxng = { baseUrl: process.env.SEARXNG_BASE_URL };
  if (process.env.FIRECRAWL_API_KEY) {
    config.firecrawl = {
      apiKey: process.env.FIRECRAWL_API_KEY,
      baseUrl: process.env.FIRECRAWL_BASE_URL,
    };
  }
  if (process.env.GEMINI_API_KEY) {
    config.gemini = {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL,
      model: process.env.GEMINI_MODEL,
    };
  }
  if (process.env.OLLAMA_API_KEY) {
    config.ollama = {
      apiKey: process.env.OLLAMA_API_KEY,
      baseUrl: process.env.OLLAMA_BASE_URL,
    };
  }
  if (process.env.AI_API_KEY) {
    const format = process.env.AI_FORMAT as 'openai' | 'anthropic' | 'gemini' | undefined;
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_AI_TIMEOUT_MS);
    config.ai = {
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      format: format ?? 'openai',
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_AI_TIMEOUT_MS,
    };
  }

  return config;
}
