import type { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import type { NormalizedSearchParams, RawProviderResult, SearchProvider } from './search-types.js';

const GEMINI_SUMMARY_URL = 'gemini://summary';

/**
 * Gemini search adapter.
 *
 * Uses Google Gemini's `googleSearch` tool to run a grounded web search and
 * returns a single synthesized result item containing the model's answer.
 *
 * Per the design decision for this PR:
 *   - returns ONE result (not multiple grounding chunks)
 *   - id/url is a sentinel `gemini://summary` so the aggregator never confuses
 *     it with a real web result and so it never collides with another provider's
 *     URL during canonicalization
 *   - the `score` produced by the RRF strategy is overwritten by the
 *     `GeminiBoostScoringStrategy` (mean of other providers' scores, or 0.5
 *     when Gemini is the only source)
 *
 * Caller-supplied filters that don't make sense for a grounded LLM call
 * (numResults, includeDomains, startDate, etc.) are silently dropped — the
 * `list` tool's capability matrix is the source of truth for what each
 * provider honors.
 */
export class GeminiSearchAdapter implements SearchProvider {
  readonly id = 'gemini';

  constructor(private readonly client: GeminiAIClient) {}

  async search(params: NormalizedSearchParams): Promise<RawProviderResult[]> {
    const signal = AbortSignal.timeout(params.timeoutMs);
    const grounded = await this.client.generateGrounded(params.query, signal);
    const answer = grounded.answer.trim();
    if (!answer) return [];

    return [
      {
        url: GEMINI_SUMMARY_URL,
        title: 'AI Summary',
        snippet: answer.slice(0, 200),
        content: answer,
      },
    ];
  }
}
