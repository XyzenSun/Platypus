# PRD: Redesign AIClient Interface

## Goal

Replace the current search-oriented `AIClient` interface with a general-purpose multi-turn messaging interface. Each implementation wraps the provider's official SDK with configurable `apiKey`, `baseUrl`, and `model`.

## Current State

- `AIClient` has `generateGrounded(query)` and `synthesize(input)` — both search-specific.
- Only Gemini is implemented; OpenAI and Anthropic are stubs.
- `GeminiSearchAdapter` calls `client.generateGrounded()` with `googleSearch` tool hardcoded.

## New Interface (`src/lib/ai-clients/types.ts`)

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface Tool {
  name: string;
  // Provider-specific tool definition passed through as-is
  definition: unknown;
}

export interface ChatOptions {
  tools?: Tool[];
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  // Tool calls the model wants to invoke, if any
  toolCalls?: { name: string; args: unknown }[];
}

export interface AIClient {
  readonly id: string;
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
}
```

## Implementation Requirements

### `GeminiAIClient` (`src/lib/ai-clients/gemini.ts`)
- Use `@google/genai` SDK (already installed).
- Constructor: `{ apiKey, baseUrl?, model? }` — same as now.
- `chat(messages, options?)`:
  - Map `Message[]` to Gemini `contents` format (system message → `systemInstruction`).
  - Pass `options.tools` through to Gemini `config.tools` if provided.
  - Wrap call in `withRetry` with `toProviderError` error mapping — same as current.
  - Return `ChatResponse` with `content` (response text) and `toolCalls` if any.

### `OpenAIAIClient` (`src/lib/ai-clients/openai.ts`)
- Use `openai` npm package — **add as dependency**.
- Constructor: `{ apiKey, baseUrl?, model? }`.
- `chat(messages, options?)`:
  - Map `Message[]` to OpenAI `ChatCompletionMessageParam[]`.
  - Pass `options.tools` as OpenAI `tools` parameter if provided.
  - Wrap with `withRetry` + `ProviderError`.
  - Return `ChatResponse`.

### `AnthropicAIClient` (`src/lib/ai-clients/anthropic.ts`)
- Use `@anthropic-ai/sdk` npm package — **add as dependency**.
- Constructor: `{ apiKey, baseUrl?, model? }`.
- `chat(messages, options?)`:
  - Extract system message (first message with `role: 'system'`) → Anthropic `system` param.
  - Map remaining messages to Anthropic `MessageParam[]`.
  - Pass `options.tools` as Anthropic `tools` if provided.
  - Wrap with `withRetry` + `ProviderError`.
  - Return `ChatResponse`.

## GeminiSearchAdapter Update (`src/providers/gemini.ts`)

The adapter currently calls `client.generateGrounded()`. After the redesign it must call `client.chat()` with the `googleSearch` tool always included:

```typescript
const googleSearchTool: Tool = {
  name: 'googleSearch',
  definition: { googleSearch: {} },
};
const response = await this.client.chat(
  [{ role: 'user', content: params.query }],
  { tools: [googleSearchTool], signal },
);
```

Extract grounding metadata from the raw Gemini response if needed for `GroundedResult` — or simplify `GeminiSearchAdapter` to return a single result from `response.content`.

## Out of Scope

- No changes to aggregator, tools, server, or config layers.
- No streaming support.
- Old `GroundedResult` / `SynthesizeInput` types are removed once nothing references them.
