import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, classifyError, classifyHttpStatus } from '../errors.js';
import { withRetry } from '../retry.js';
import type { AIClient, ChatOptions, ChatResponse, Message } from './types.js';

const DEFAULT_MODEL = 'claude-3-haiku-20240307';

export interface AnthropicAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class AnthropicAIClient implements AIClient {
  readonly id = 'anthropic' as const;

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: AnthropicAIClientOptions) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
    });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    return withRetry(async () => {
      try {
        const systemMsg = messages.find((m) => m.role === 'system');
        const rest = messages.filter((m) => m.role !== 'system');

        const anthropicMessages: Anthropic.MessageParam[] = rest.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const tools = options?.tools?.map((t) => ({
          name: t.name,
          ...(t.definition as object),
        })) as Anthropic.Tool[] | undefined;

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          messages: anthropicMessages,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          ...(tools && tools.length > 0 ? { tools } : {}),
          ...(options?.signal ? { signal: options.signal } : {}),
        });

        const toolCalls = response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map((b) => ({ name: b.name, args: b.input }));

        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');

        return {
          content: textBlock?.text ?? '',
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        };
      } catch (err) {
        throw toProviderError('anthropic', err);
      }
    });
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
