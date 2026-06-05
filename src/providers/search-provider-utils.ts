import { createHash } from 'node:crypto';
import type {
  ProviderSearchParams,
  RawProviderResult,
  SearchExecution,
  SearchLanguage,
  SearchProvider,
  SearchProviderCapabilityNote,
  SearchRegion,
  SearchTopic,
} from './search-types.js';

function parseDomainList(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}

function extractHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function filterResultsByDomains(
  results: RawProviderResult[],
  includeDomains?: string,
  excludeDomains?: string,
): RawProviderResult[] {
  const includes = parseDomainList(includeDomains);
  const excludes = parseDomainList(excludeDomains);

  return results.filter((result) => {
    const hostname = extractHostname(result.url);
    if (!hostname) return includes.length === 0;
    if (includes.length > 0 && !includes.some((domain) => matchesDomain(hostname, domain))) {
      return false;
    }
    if (excludes.some((domain) => matchesDomain(hostname, domain))) {
      return false;
    }
    return true;
  });
}

export function limitResults(results: RawProviderResult[], limit: number): RawProviderResult[] {
  return results.slice(0, Math.max(0, limit));
}

export function appendLanguageIfNeeded(query: string, language?: SearchLanguage): string {
  if (language === 'zh_cn') return `${query} 中文信息`;
  if (language === 'us_en') return `${query} english information`;
  return query;
}

export function appendRegionIfNeeded(query: string, region?: SearchRegion): string {
  return region ? `${query} region:+${region}` : query;
}

export function appendDateRangeToQuery(
  query: string,
  publishedAfter?: string,
  publishedBefore?: string,
): string {
  let rewritten = query;
  if (publishedAfter) rewritten = `${rewritten} after ${publishedAfter}`;
  if (publishedBefore) rewritten = `${rewritten} before ${publishedBefore}`;
  return rewritten;
}

export function appendBraveDomainFilters(
  query: string,
  includeDomains?: string,
  excludeDomains?: string,
): string {
  const includes = parseDomainList(includeDomains);
  const excludes = parseDomainList(excludeDomains);
  let rewritten = query;
  for (const domain of includes) {
    rewritten = `${rewritten} site:${domain}`;
  }
  for (const domain of excludes) {
    rewritten = `${rewritten} -site:${domain}`;
  }
  return rewritten;
}

export function appendBraveTopicIfNeeded(query: string, topic: SearchTopic): string {
  if (topic === 'news') return `${query} latest news`;
  if (topic === 'finance') return `${query} finance market earnings`;
  return query;
}

export function appendSearxngTopicIfNeeded(query: string, topic: SearchTopic): string {
  if (topic === 'news') return `${query} news`;
  if (topic === 'finance') return `${query} finance`;
  return query;
}

export function appendSearxngDateIfNeeded(
  query: string,
  publishedAfter?: string,
  publishedBefore?: string,
): string {
  let rewritten = query;
  if (publishedAfter) rewritten = `${rewritten} after:${publishedAfter}`;
  if (publishedBefore) rewritten = `${rewritten} before:${publishedBefore}`;
  return rewritten;
}

export function mapLanguageCode(language?: SearchLanguage): 'zh' | 'en' | undefined {
  if (language === 'zh_cn') return 'zh';
  if (language === 'us_en') return 'en';
  return undefined;
}

export function buildCapabilityNote(
  provider: string,
  note: Omit<SearchProviderCapabilityNote, 'provider'>,
): SearchProviderCapabilityNote {
  return {
    provider,
    ...note,
  };
}

export function buildMissingUrlIdentitySeed(provider: string, result: RawProviderResult): string {
  return createHash('sha256')
    .update(provider)
    .update('\0')
    .update(result.title || 'null')
    .update('\0')
    .update(result.content || 'null')
    .digest('hex');
}

export abstract class CompiledSearchProvider implements SearchProvider {
  abstract readonly id: string;

  protected abstract execute(params: ProviderSearchParams): Promise<RawProviderResult[]>;

  protected buildCapabilityNote(
    _params: ProviderSearchParams,
  ): SearchProviderCapabilityNote | undefined {
    return undefined;
  }

  async search(params: ProviderSearchParams): Promise<SearchExecution> {
    const results = await this.execute(params);
    return {
      provider: this.id,
      results,
      capabilityNote: this.buildCapabilityNote(params),
    };
  }
}
