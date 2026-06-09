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

> **Warning — SDK 内部字段名与对外抽象字段名可能不同**
>
> 我们把"自定义上游 URL"对外统一叫 `baseUrl`（小写 url），但各家 SDK 的构造函数字段名各不相同。调用 SDK 时**必须**按 SDK 真实字段名传，否则会被静默忽略并 fallback 到 SDK 默认域名（例如 OpenAI 会落到 `api.openai.com`），表现就是"明明配了 AI_BASE_URL，请求却到不了上游"。

## SDK Base-URL Field Mapping (CRITICAL)

| Client | 对外字段（`*ClientOptions`） | SDK 构造函数实际字段 | 来源 |
|--------|------------------------------|----------------------|------|
| `OpenAIAIClient` | `baseUrl` | **`baseURL`**（大写 URL） | [openai-node v6 README](https://github.com/openai/openai-node/blob/v6.1.0/README.md) |
| `AnthropicAIClient` | `baseUrl` | **`baseURL`**（大写 URL） | [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) |
| `GeminiAIClient` | `baseUrl` | **`httpOptions.baseUrl`**（小写 url） | [@google/genai](https://github.com/googleapis/js-genai) |

### Convention: SDK Construction

**What**: 实现新 AI client 时，构造函数里映射对外 `baseUrl` 到 SDK 字段，**必须**先确认 SDK 真实字段名拼写，不能想当然。

**Why**: SDK 构造函数普遍**不会**对未知字段报错或警告，错拼字段名会被静默忽略，bug 直到运行时（且只在自定义 baseUrl 路径上）才暴露。

**Example**:

```typescript
// src/lib/ai-clients/openai.ts
constructor(opts: OpenAIAIClientOptions) {
  this.client = new OpenAI({
    apiKey: opts.apiKey,
    // 对外字段是 baseUrl，OpenAI SDK 真实字段是 baseURL（大写 URL）
    ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
  });
}
```

```typescript
// src/lib/ai-clients/gemini.ts
constructor(opts: GeminiAIClientOptions) {
  // GoogleGenAI 通过 httpOptions 接收 baseUrl（小写 url，与对外字段一致）
  const httpOptions = opts.baseUrl ? { baseUrl: opts.baseUrl } : undefined;
  this.client = new GoogleGenAI({ apiKey: opts.apiKey, httpOptions });
}
```

### Common Mistake: 字段名想当然

**Symptom**: 自定义 `AI_BASE_URL` 完全没被使用，请求直接落到 SDK 默认上游（OpenAI → `api.openai.com`），通常表现为 401/认证失败；如果错误又被业务层 catch 吞掉，会变成"完全无响应/没有任何信号"。

**Cause**: SDK 字段名约定不统一（OpenAI/Anthropic 用 `baseURL`，Gemini 用 `httpOptions.baseUrl`），从对外 `baseUrl` 复制粘贴时容易丢掉大小写差异。

**Fix**: 按本节"SDK Base-URL Field Mapping"表对照修正。

**Prevention**:
- 增加/修改任何 AI client SDK 集成前，先查该 SDK 的最新 README/官方示例，确认构造函数字段名。
- 写单元测试时**必须**断言"外部 `baseUrl` 被透传到 SDK 真实字段"，并且这种测试要能**在 pre-fix 代码上失败**——否则测试无效。参考 `tests/unit/openai-client.test.ts`。

## Cross-Layer Contract: `cleanResult` 容错

### 1. Scope / Trigger
- 触发：`src/aggregator/ai-aggregation.ts` 调用 `AIClient.chat`；任何 SDK 集成层错误（401/网络/超时/AbortError）都会抛到这里。

### 2. Signatures
- `cleanResult(client, query, result, hasContent, timeoutMs) -> Promise<SearchResult>`（内部函数，通过 `maybeRunAIAggregation` 的可选 `client` 参数注入 mock 进行测试）。

### 3. Contracts
- Input: `client: AIClient`、`query: string`、`result: SearchResult`、`hasContent: boolean`、`timeoutMs: number`。
- Output: 永远返回 `SearchResult`——成功则字段被 AI 清洗后内容替换，失败则**原 result 原样返回**。
- 失败副作用：必须调用 `log(...)`（`src/server/logger.ts`，写 stderr）把 `err.message` 透出，**禁止 console.log/error**（违反 `logging-guidelines.md`，会污染 MCP stdio）。

### 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| `client.chat` 抛 `ProviderError`（任何 category） | 调 `log()`；返回原 result；不再抛 |
| `client.chat` 抛超时/AbortError | 调 `log()`；返回原 result；不再抛 |
| `client.chat` 返回空字符串 | 不调 `log()`；返回原 result（不空覆盖） |
| `client.chat` 返回正常文本 | 用 trim 后文本覆盖 `title` 或 `content`（取决于 `hasContent`） |

### 5. Good/Base/Bad Cases
- **Good**: SDK 正常响应非空文本 → 字段被替换。
- **Base**: SDK 抛 `ProviderError(QUOTA, '401', ...)` → log 记录；用户看到原 result，MCP 协议不被打断。
- **Bad（禁止）**: catch 块只 `return result`，不 log → 用户和维护者都看不到 SDK 失败信号，bug 完全隐形（本任务暴露的就是这个）。

### 6. Tests Required
- 注入 mock client 让 `chat` reject `new ProviderError(...)`，断言：
  - `log` 被调用一次
  - `log` 参数包含原 error 的 `message`
  - 返回的 result 与输入 result **结构相等**
- 注入 mock client 让 `chat` 返回空字符串，断言：返回的 result 与输入 result 结构相等，且 `log` 未被调用。
- 注入 mock client 让 `chat` 返回 `'cleaned text'`，断言：返回 result 的 `content`（或 `title`）等于 `'cleaned text'`。

### 7. Wrong vs Correct

#### Wrong

```typescript
// src/aggregator/ai-aggregation.ts —— 旧实现
try {
  const response = await client.chat(messages, { ... });
  // ...
} catch {
  return result;   // 错误被静默吞掉，连 stderr 都没有
}
```

#### Correct

```typescript
import { log } from '../server/logger.js';

try {
  const response = await client.chat(messages, { ... });
  // ...
} catch (err) {
  log(
    `[ai-aggregation] cleanResult failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  return result;
}
```

## Role Mapping

| `Message.role` | Gemini | OpenAI | Anthropic |
|----------------|--------|--------|-----------|
| `user` | `user` | `user` | `user` |
| `assistant` | `model` | `assistant` | `assistant` |
| `system` | `config.systemInstruction` | `system` | top-level `system` param |

Anthropic: extract the first `system` message before building `MessageParam[]`. The remaining messages must start with `user`.

### Don't: 把同一段 prompt 同时塞进 system 和 user

**Problem**:

```typescript
// Don't do this
const prompt = buildPrompt(...);
const messages: Message[] = [
  { role: 'system', content: prompt },
  { role: 'user', content: prompt },   // 完全重复
];
```

**Why it's bad**:
- 同一段 prompt 被发送两遍，浪费 token、增加延迟。
- 在 Anthropic 路径上由于 `system` 被拆走，`user` 仍是同一段 prompt——没省下任何成本。
- 对 OpenAI / ModelScope 类 OpenAI-format provider，重复 system 还可能触发模型对"上下文重复"的去重或忽略行为，得到的清洗结果不稳定。

**Instead**:

```typescript
// Do this
const messages: Message[] = [{ role: 'user', content: prompt }];
```

如果确实需要分 system / user，应把"指令"放 system、"待处理内容"放 user，两段内容不重叠。

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
