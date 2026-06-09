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
- 同样适用于 `client.chat` 返回空字符串（trim 后为空）的"伪成功"分支——它和异常一样按失败处理。

### 2. Signatures
- `cleanResult(client, query, result, hasContent, timeoutMs) -> Promise<{ result: SearchResult; warning?: SearchWarning }>`（内部函数，通过 `maybeRunAIAggregation` 的可选 `client` 参数注入 mock 进行测试）。
- `maybeRunAIAggregation` 负责聚合每条 `cleanResult` 返回的 warning，并 spread 进 `SearchResponse.warnings`；**cleanResult 自己不允许 mutate** response。

### 3. Contracts
- Input: `client: AIClient`、`query: string`、`result: SearchResult`、`hasContent: boolean`、`timeoutMs: number`。
- Output: 永远返回 `{ result, warning? }`：
  - 成功（chat 返回非空文本）→ `result` 的目标字段（hasContent 决定 `content` 还是 `title`）= `AI_AGGREGATION_SUCCESS_PREFIX + cleanedText`；`warning` 为 `undefined`。
  - 失败（chat 抛异常 **或** trim 后为空）→ `result` 的目标字段 = `AI_AGGREGATION_FAIL_PREFIX + originalFieldValue`；`warning` 必填，结构见 §4。
- 失败副作用：必须调用 `log(...)`（`src/server/logger.ts`，写 stderr）把失败原因透出，前缀固定 `[ai-aggregation]`。**禁止 console.log/error**（违反 `logging-guidelines.md`，会污染 MCP stdio）。
- 失败时 **不**抛异常——保持 MCP 协议不被打断。

### 4. Failure Warning Shape

失败时 `cleanResult` 返回的 `warning` 字段：

| 字段 | 值 |
|------|-----|
| `provider` | `AI_AGGREGATION_WARNING_PROVIDER`（`'ai-aggregation'`） |
| `code` | `AI_AGGREGATION_WARNING_CODE`（`'AI_CLEAN_FAILED'`） |
| `message` | `Array.from(rawMessage).slice(0, AI_AGGREGATION_WARNING_MESSAGE_MAX).join('')`——按"字符"截到前 50 个，**不**加 `...` 尾缀 |

`rawMessage` 来源：
- chat throw：`err instanceof Error ? err.message : String(err)`
- 空响应：固定字符串 `AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE`（`'ai returned empty content'`）

> 用 `Array.from` 而非 `substring` / slice，是为了把 emoji / 多字节字符当一个字符处理，避免截到半字节。

### 5. Validation & Error Matrix

| 条件 | 返回 `result` 字段 | 返回 `warning` | 是否 `log()` |
|------|------------------|---------------|-------------|
| `client.chat` 返回非空文本 | `AI_AGGREGATION_SUCCESS_PREFIX + cleanedText` | 无 | 否 |
| `client.chat` 抛 `ProviderError`（任何 category） | `AI_AGGREGATION_FAIL_PREFIX + originalFieldValue` | 有（message=err.message 截 50） | 是 |
| `client.chat` 抛超时/AbortError | `AI_AGGREGATION_FAIL_PREFIX + originalFieldValue` | 有（message=err.message 截 50） | 是 |
| `client.chat` 返回 trim 后为空 | `AI_AGGREGATION_FAIL_PREFIX + originalFieldValue` | 有（message=`'ai returned empty content'`） | 是 |

`hasContent=true` 时操作 `content` 字段，`hasContent=false` 时操作 `title` 字段——路由保持不变。

### 6. Good/Base/Bad Cases
- **Good**: SDK 正常响应非空文本 → 字段被 Success 前缀 + 清洗后文本替换；客户端一眼能看出"这段被 AI 重写过"。
- **Base**: SDK 抛 `ProviderError(QUOTA, '401', ...)` → log 记录；目标字段被 Fail 前缀 + 原值回写；客户端在 `warnings[]` 看到 `AI_CLEAN_FAILED`，并能继续使用原始内容；MCP 协议不被打断。
- **Bad（禁止）**:
  - catch 块只 `return result`，不 log、不加前缀、不抛 warning → 失败被伪装成成功，调用方无法分辨。
  - 把 50 字符截断写成 `substring(0, 50)` 或 `slice` 字节 → 多字节字符会被切坏，emoji 显示乱码。
  - 在 `cleanResult` 内部直接 mutate `response.warnings` → 违反单一职责，破坏可测性。

### 7. Tests Required
- 注入 mock client 让 `chat` reject `new Error('boom')`，断言：
  - `log` 被调用，且参数包含 `'[ai-aggregation]'` 与 `'boom'`。
  - 返回 result 的目标字段 = `AI_AGGREGATION_FAIL_PREFIX + originalFieldValue`。
  - `response.warnings` 多 1 条，等于 `{ provider:'ai-aggregation', code:'AI_CLEAN_FAILED', message:'boom' }`。
- 注入 mock client 让 `chat` reject `new Error('x'.repeat(80))`，断言：warning.message 的**字符长度**严格等于 `AI_AGGREGATION_WARNING_MESSAGE_MAX`，且**不**以 `...` 结尾。
- 注入 mock client 让 `chat` 返回 `{ content: '   ' }`，断言：目标字段带 Fail 前缀 + 原值；warning.message = `'ai returned empty content'`；`log` 被调用 ≥1 次。
- 注入 mock client 让 `chat` 返回非空文本，断言：目标字段 = `AI_AGGREGATION_SUCCESS_PREFIX + cleanedText`；`warnings` 长度不变；`log` 未被调用。
- 注入 mock client 让多条 result 都 reject，断言：`warnings.length` = 失败 result 数，按调用顺序排列。
- 上述测试必须能在 pre-fix 实现上失败（per `Prevention` 段）。

### 8. Wrong vs Correct

#### Wrong（更早一代实现：catch 全静默）

```typescript
// src/aggregator/ai-aggregation.ts —— v1（已废弃）
try {
  const response = await client.chat(messages, { ... });
  // ...
} catch {
  return result;   // 错误被静默吞掉，连 stderr 都没有
}
```

#### Wrong（v2：只 log，但失败仍伪装成成功）

```typescript
// src/aggregator/ai-aggregation.ts —— v2（已废弃）
try {
  const response = await client.chat(messages, { ... });
  // ...
} catch (err) {
  log(`[ai-aggregation] cleanResult failed: ${err instanceof Error ? err.message : String(err)}`);
  return result;   // 调用方仍然看不到失败信号
}
```

#### Correct（v3：当前契约）

```typescript
import { log } from '../server/logger.js';

try {
  const response = await client.chat(messages, { ... });
  const cleanedText = response.content.trim();
  if (!cleanedText) {
    log(`[ai-aggregation] cleanResult failed: ${AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE}`);
    return {
      result: applyFailPrefix(result, hasContent),
      warning: buildFailureWarning(AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE),
    };
  }
  return { result: applySuccessPrefix(result, hasContent, cleanedText) };
} catch (err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  log(`[ai-aggregation] cleanResult failed: ${rawMessage}`);
  return {
    result: applyFailPrefix(result, hasContent),
    warning: buildFailureWarning(rawMessage),   // message 经 Array.from + slice(0, 50)
  };
}
```

`maybeRunAIAggregation` 端将每条 `warning` push 到累积数组，最后 `warnings: [...response.warnings, ...accumulated]` 回填。

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
