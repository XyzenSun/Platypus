# AI Clients

## Interface (`src/lib/ai-clients/types.ts`)

```typescript
interface AIClient {
  readonly id: string;
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
}

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }
interface Tool    { name: string; definition: unknown; }
interface ChatOptions { tools?: Tool[]; signal?: AbortSignal; }
interface ChatResponse { content: string; toolCalls?: { name: string; args: unknown }[]; }
```

General-purpose multi-turn messaging — not search-specific. `GroundedResult` and `SynthesizeInput` are gone.

## Implementations

| Class | SDK | File |
|-------|-----|------|
| `GeminiAIClient` | `@google/genai` | `src/lib/ai-clients/gemini.ts` |
| `OpenAIAIClient` | `openai` | `src/lib/ai-clients/openai.ts` |
| `AnthropicAIClient` | `@anthropic-ai/sdk` | `src/lib/ai-clients/anthropic.ts` |

All three accept `{ apiKey, baseUrl?, model? }` in their constructor.

## Role Mapping

| `Message.role` | Gemini | OpenAI | Anthropic |
|----------------|--------|--------|-----------|
| `user` | `user` | `user` | `user` |
| `assistant` | `model` | `assistant` | `assistant` |
| `system` | `config.systemInstruction` | `system` | top-level `system` param |

Anthropic: extract the first `system` message before building `MessageParam[]`. The remaining messages must start with `user`.

## Tools

Pass `Tool[]` via `ChatOptions.tools`. Each implementation maps `tool.definition` to its SDK's native format:
- Gemini: casts directly to `GeminiTool[]`
- OpenAI: wraps as `{ type: 'function', function: tool.definition }`
- Anthropic: spreads `tool.definition` fields into the Anthropic tool shape

## googleSearch Tool (GeminiSearchAdapter)

`GeminiSearchAdapter` always passes `{ name: 'googleSearch', definition: { googleSearch: {} } }` to `client.chat()`. This is the only place that hardcodes a tool.

Reference: `src/providers/gemini.ts`.

## Error Handling

All three implementations wrap the SDK call in `withRetry` and map errors to `ProviderError` via `classifyHttpStatus` / `classifyError`. Same pattern as provider adapters.
