> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Primary API reference: https://docs.tavily.com/documentation/api-reference/endpoint/extract
> Help article: https://help.tavily.com/articles/8721959612-what-is-the-tavily-extract-api

# Tavily Extract

Tavily Extract 用于对一个或多个指定 URL 抽取网页内容。当前项目的 fetch adapter 使用它作为 `tavily` 抓取 provider。

---

## 1. Endpoint

```http
POST https://api.tavily.com/extract
```

当前项目代码：

- Adapter：`src/providers/tavily-fetch.ts`
- 常量默认值：`https://api.tavily.com/extract`
- 可选覆盖：`baseUrl` 会去掉末尾 `/` 后拼接 `/extract`

---

## 2. Auth

```http
Authorization: Bearer tvly-YOUR_API_KEY
Content-Type: application/json
```

OpenAPI 中认证方式为 Bearer auth；API key 示例为 `tvly-YOUR_API_KEY`。

当前项目对应关系：

```ts
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
}
```

---

## 3. Request Body

官方字段摘要：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `urls` | `string \| string[]` | 是 | 单个 URL 或 URL 数组；帮助文档说明最多 20 个 URL。 |
| `query` | `string` | 否 | 用于内容 chunk rerank 的用户意图。 |
| `chunks_per_source` | `number` | 否 | `query` 存在时可用，1-5；控制每个来源返回的相关片段数。 |
| `extract_depth` | `basic \| advanced` | 否 | 默认 `basic`；`advanced` 成功率/内容覆盖更高但更慢、成本更高。 |
| `format` | `markdown \| text` | 否 | 默认 `markdown`；`text` 可能增加延迟。 |
| `include_images` | `boolean` | 否 | 是否返回图片 URL。 |
| `include_favicon` | `boolean` | 否 | 是否返回 favicon。 |
| `timeout` | `number` | 否 | 秒，1-60；默认随 `extract_depth` 变化。 |
| `include_usage` | `boolean` | 否 | 是否返回 credit usage。 |

当前项目发送：

```json
{
  "urls": ["https://example.com/"],
  "format": "markdown",
  "extract_depth": "basic"
}
```

项目中的 `format` 来自统一 fetch 入参 `params.format`，`urls` 即使单 URL 也以数组形式发送。

---

## 4. Success Response Fields

HTTP 200 时，Tavily Extract 返回结构：

```json
{
  "results": [
    {
      "url": "https://example.com/",
      "raw_content": "Example Domain\n...",
      "images": [],
      "favicon": "https://example.com/favicon.ico"
    }
  ],
  "failed_results": [],
  "response_time": 0.42,
  "usage": { "credits": 1 },
  "request_id": "123e4567-e89b-12d3-a456-426614174111"
}
```

字段说明：

| 字段 | 说明 | 当前项目是否使用 |
|---|---|---:|
| `results[].url` | 成功抽取的 URL | 是，映射到 `RawFetchResult.url` |
| `results[].raw_content` | 抽取正文；当使用 `query` 时可能是 chunk 拼接内容 | 是，映射到 `RawFetchResult.content` |
| `results[].images` | 图片 URL，仅 `include_images=true` 时 | 否 |
| `results[].favicon` | favicon，仅 `include_favicon=true` 时 | 否 |
| `failed_results[]` | 单 URL 失败列表 | 仅当 `results[0]` 缺失时读取第一个 error |
| `response_time` | 请求耗时 | 否 |
| `usage` | credit 使用量 | 否 |
| `request_id` | 支持排查用请求 ID | 否 |

当前项目成功映射：

```ts
return {
  url: first.url,
  content: first.raw_content ?? '',
  format: params.format,
  fetchedAt: new Date().toISOString(),
};
```

注意：当前 adapter 对 `raw_content` 为空字符串仍返回 fulfilled；后续 best-result 聚合应将空内容视为无效候选。

---

## 5. Failure / Error Fields

### 5.1 Request-level HTTP errors

官方 OpenAPI 列出的典型非 2xx：

| HTTP | 语义 | 响应字段 |
|---:|---|---|
| 400 | Bad Request，例如 URL 数量超限 | `detail.error` |
| 401 | API key 缺失或错误 | `detail.error` |
| 429 | rate limit | `detail.error` |
| 432 | key limit / plan limit exceeded | `detail.error` |
| 433 | PayGo limit exceeded | `detail.error` |
| 500 | 服务端错误 | `detail.error` |

当前项目处理：非 OK 时读取 `res.text()`，用 `classifyHttpStatus(res.status)` 分类并抛 `ProviderError('tavily', category, String(status), textOrStatusText)`。

### 5.2 Per-URL extraction failures

HTTP 200 仍可能存在单 URL 失败：

```json
{
  "results": [],
  "failed_results": [
    {
      "url": "https://blocked.example/",
      "error": "Unable to extract content from URL"
    }
  ]
}
```

当前项目当 `results[0]` 缺失时：

- 读取 `failed_results[0].error`
- 抛 `ProviderError('tavily', 'USER_ERROR', 'NO_RESULTS', message)`

---

## 6. Blocked / 401 / 403 / CDN / Anti-bot Signals

官方文档没有提供结构化的 `isBlocked` / `isCloudflare` 字段。

可用信号：

| 场景 | 可用信号 | 备注 |
|---|---|---|
| API key 错误 | request-level HTTP 401 + `detail.error` | 这是 Tavily API 认证失败，不代表目标站点 401。 |
| 额度/计划限制 | HTTP 432 / 433 | 项目分类为 quota 类错误。 |
| rate limit | HTTP 429 | 项目分类为 network/retry 类错误。 |
| 目标 URL 处理失败 | HTTP 200 + `failed_results[].error` | error 是字符串，官方未保证结构化状态码。 |
| 空抽取 | `results[].raw_content` 缺失或空字符串 | 当前 adapter 会返回空内容；聚合层需二次判定。 |
| CDN/Cloudflare/反爬 | `failed_results[].error` 文本，或 `raw_content`/标题中出现 challenge/blocked 文案 | 无专用字段，只能启发式判断。 |

---

## 7. Current Adapter Relation

| 项目字段/行为 | Tavily 字段/行为 |
|---|---|
| `provider id` | `tavily` |
| endpoint | `POST /extract` |
| auth | `Authorization: Bearer ${apiKey}` |
| body URL | `urls: [url]` |
| body format | `format: params.format` |
| depth | 固定 `extract_depth: 'basic'` |
| success URL | `results[0].url` |
| success content | `results[0].raw_content ?? ''` |
| title | Tavily Extract 不返回 title，当前不设置 |
| error if no results | `failed_results[0].error` -> `ProviderError(..., 'NO_RESULTS', ...)` |
| timeout | 使用 `AbortSignal.timeout(params.timeoutMs)`，不是 Tavily body 的 `timeout` 字段 |

---

## 8. Notes for Best-result Fetch

- 不要把 `Promise fulfilled` 等同成功；`raw_content` 为空时应视为无效候选。
- Tavily 没有结构化目标 HTTP status；阻挡页主要依赖 `failed_results[].error` 和内容文本特征。
- 若后续要提高成功率，可考虑实测 `extract_depth: 'advanced'`，但这会改变成本与延迟，应单独决策。
