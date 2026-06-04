import { GoogleGenAI } from '@google/genai';
import { ProviderError, classifyError, classifyHttpStatus } from '../errors.js';
import { withRetry } from '../retry.js';
import type { AIClient, GroundedResult, SynthesizeInput } from './types.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export interface GeminiAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Gemini AI client using the official @google/genai SDK.
 *
 * - `generateGrounded(query)` runs a model call with the `googleSearch` tool enabled,
 *   returning the LLM-synthesized answer plus grounding metadata (web search queries
 *   the model issued, list of source URIs and titles).
 * - `synthesize(input)` is the mode=high entry point; intentionally unimplemented
 *   for this PR (PR6 will fill it in).
 */
export class GeminiAIClient implements AIClient {
  readonly id = 'gemini' as const;

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(opts: GeminiAIClientOptions) {
    const httpOptions = opts.baseUrl ? { baseUrl: opts.baseUrl } : undefined;
    this.client = new GoogleGenAI({ apiKey: opts.apiKey, httpOptions });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async generateGrounded(query: string, signal?: AbortSignal): Promise<GroundedResult> {
    return withRetry(async () => {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: query,
          config: {
            tools: [{ googleSearch: {} }],
            ...(signal ? { abortSignal: signal } : {}),
          },
        });

        const answer = response.text ?? '';
        const meta = response.candidates?.[0]?.groundingMetadata;
        const searchQueries = meta?.webSearchQueries ?? [];
        const chunks =
          meta?.groundingChunks
            ?.map((c) => ({
              uri: c.web?.uri ?? '',
              title: c.web?.title ?? '',
            }))
            .filter((c) => c.uri) ?? [];

        return { answer, searchQueries, chunks };
      } catch (err) {
        throw this.toProviderError(err);
      }
    });
  }

  async synthesize(_input: SynthesizeInput, _signal?: AbortSignal): Promise<string> {
    throw new Error('Gemini synthesize not yet implemented (PR6)');
  }

  private toProviderError(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;
    // The SDK surfaces HTTP failures via Error with a numeric status field or an
    // embedded status string. Normalise them through the shared classifier.
    const anyErr = err as { status?: number; code?: number | string; message?: string };
    const status =
      typeof anyErr.status === 'number'
        ? anyErr.status
        : typeof anyErr.code === 'number'
          ? anyErr.code
          : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (typeof status === 'number') {
      const category = classifyHttpStatus(status);
      return new ProviderError('gemini', category, String(status), message);
    }
    const category = classifyError(err);
    const code =
      err instanceof Error && err.name
        ? err.name
        : typeof anyErr.code === 'string'
          ? anyErr.code
          : 'UNKNOWN';
    return new ProviderError('gemini', category, code, message);
  }
}
