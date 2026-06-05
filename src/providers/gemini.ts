import type { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import type { Tool } from '../lib/ai-clients/types.js';
import type { NormalizedSearchParams, RawProviderResult, SearchProvider } from './search-types.js';

export const GEMINI_SUMMARY_URL =
  'gemini://Gemini search has no persistent URL, Do not crawl this link';

const googleSearchTool: Tool = {
  name: 'googleSearch',
  definition: { googleSearch: {} },
};

export class GeminiSearchAdapter implements SearchProvider {
  readonly id = 'gemini';

  constructor(private readonly client: GeminiAIClient) {}

  async search(params: NormalizedSearchParams): Promise<RawProviderResult[]> {
    const signal = AbortSignal.timeout(params.timeoutMs);
    const response = await this.client.chat([{ role: 'user', content: params.query }], {
      tools: [googleSearchTool],
      signal,
    });
    const answer = response.content.trim();
    if (!answer) return [];

    if (params.hasContent) {
      const content = answer;
      const title = content.slice(0, 100);
      return [{ url: GEMINI_SUMMARY_URL, title, content }];
    }
    const title = answer;
    return [{ url: GEMINI_SUMMARY_URL, title }];
  }
}
