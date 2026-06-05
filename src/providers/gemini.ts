import type { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import type { Tool } from '../lib/ai-clients/types.js';
import { CompiledSearchProvider, buildCapabilityNote } from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

export const GEMINI_SUMMARY_URL =
  'gemini://Gemini search has no persistent URL, Do not crawl this link';

const googleSearchTool: Tool = {
  name: 'googleSearch',
  definition: { googleSearch: {} },
};

export class GeminiSearchAdapter extends CompiledSearchProvider {
  readonly id = 'gemini';

  constructor(private readonly client: GeminiAIClient) {
    super();
  }

  protected buildCapabilityNote(): ReturnType<typeof buildCapabilityNote> {
    return buildCapabilityNote(this.id, {
      ignoredFields: [
        'includeDomains',
        'excludeDomains',
        'publishedAfter',
        'publishedBefore',
        'topic',
        'language',
        'region',
        'searchEffort',
      ],
      notes: ['Gemini search only uses query, timeoutMs, and hasContent.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
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
    return [{ url: GEMINI_SUMMARY_URL, title: answer }];
  }
}
