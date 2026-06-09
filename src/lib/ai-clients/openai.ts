import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { ProviderError, classifyError, classifyHttpStatus } from '../errors.js';
import { withRetry } from '../retry.js';
import type { AIClient, ChatOptions, ChatResponse, Message } from './types.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAIAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAIAIClient implements AIClient {
  readonly id = 'openai' as const;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: OpenAIAIClientOptions) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
    });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    return withRetry(async () => {
      try {
        const oaiMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const tools = options?.tools?.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, ...(t.definition as object) },
        }));

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: oaiMessages,
          ...(tools && tools.length > 0 ? { tools } : {}),
          ...(options?.signal ? { signal: options.signal } : {}),
        });

        const msg = response.choices[0]?.message;
        const toolCalls = msg?.tool_calls
          ?.filter(
            (tc): tc is typeof tc & { function: { name: string; arguments: string } } =>
              'function' in tc,
          )
          .map((tc) => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments) as unknown,
          }));

        return {
          content: msg?.content ?? '',
          ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        };
      } catch (err) {
        throw toProviderError('openai', err);
      }
    }, options?.retryDelays);
  }
}

function toProviderError(provider: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  const anyErr = err as { status?: number; code?: number | string };
  const message = err instanceof Error ? err.message : String(err);
  if (typeof anyErr.status === 'number') {
    return new ProviderError(
      provider,
      classifyHttpStatus(anyErr.status),
      String(anyErr.status),
      message,
    );
  }
  const category = classifyError(err);
  const code =
    err instanceof Error && err.name
      ? err.name
      : typeof anyErr.code === 'string'
        ? anyErr.code
        : 'UNKNOWN';
  return new ProviderError(provider, category, code, message);
}
