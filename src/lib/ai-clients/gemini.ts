import type { Tool as GeminiTool } from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { ProviderError, classifyError, classifyHttpStatus } from '../errors.js';
import { withRetry } from '../retry.js';
import type { AIClient, ChatOptions, ChatResponse, Message } from './types.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export interface GeminiAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class GeminiAIClient implements AIClient {
  readonly id = 'gemini' as const;

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(opts: GeminiAIClientOptions) {
    const httpOptions = opts.baseUrl ? { baseUrl: opts.baseUrl } : undefined;
    this.client = new GoogleGenAI({ apiKey: opts.apiKey, httpOptions });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    return withRetry(async () => {
      try {
        const systemMsg = messages.find((m) => m.role === 'system');
        const contents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        const tools = options?.tools?.map((t) => t.definition) as GeminiTool[] | undefined;

        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: {
            ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
            ...(tools ? { tools } : {}),
            ...(options?.signal ? { abortSignal: options.signal } : {}),
          },
        });

        const toolCalls = response.candidates?.[0]?.content?.parts
          ?.filter((p) => p.functionCall != null)
          .map((p) => ({ name: p.functionCall?.name ?? '', args: p.functionCall?.args ?? {} }));

        return {
          content: response.text ?? '',
          ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        };
      } catch (err) {
        throw this.toProviderError(err);
      }
    }, options?.retryDelays);
  }

  private toProviderError(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;
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
