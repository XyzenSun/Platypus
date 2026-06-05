import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { NormalizedSearchParams, RawProviderResult, SearchProvider } from './search-types.js';

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const EXA_MAX_NUM_RESULTS = 100;

const CATEGORY_MAP: Record<string, string> = {
  news: 'news',
  company: 'company',
  people: 'people',
  research: 'research paper',
  github: 'github',
  pdf: 'pdf',
  finance: 'financial report',
  // general and others → omit (use default)
};

const TYPE_MAP: Record<string, string> = {
  fast: 'keyword',
  balanced: 'auto',
  deep: 'neural',
};

export class ExaSearchAdapter implements SearchProvider {
  readonly id = 'exa';

  constructor(private readonly apiKey: string) {}

  async search(params: NormalizedSearchParams): Promise<RawProviderResult[]> {
    const isPersonOrCompany = params.topic === 'company' || params.topic === 'people';

    const body: Record<string, unknown> = {
      query: params.query,
      numResults: Math.min(params.perChannelMaxResults, EXA_MAX_NUM_RESULTS),
      type: TYPE_MAP[params.searchDepth] ?? 'auto',
    };

    const category = CATEGORY_MAP[params.topic];
    if (category) body.category = category;

    // Guard: company/people categories reject domain filters and date filters
    if (!isPersonOrCompany) {
      if (params.includeDomains) {
        body.includeDomains = params.includeDomains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      }
      if (params.excludeDomains) {
        body.excludeDomains = params.excludeDomains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      }
      if (params.startDate) body.startPublishedDate = `${params.startDate}T00:00:00Z`;
      if (params.endDate) body.endPublishedDate = `${params.endDate}T23:59:59Z`;
    }

    if (params.hasContent) {
      body.contents = { text: { maxCharacters: 2000 } };
    }

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(EXA_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('exa', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results: { url: string; title: string; text?: string; publishedDate?: string }[];
      };

      return data.results
        .filter((r) => r.url)
        .map((r) => ({
          url: r.url,
          title: r.title,
          content: params.hasContent ? (r.text ?? undefined) : undefined,
          publishedDate: r.publishedDate ?? undefined,
        }));
    });
  }
}
