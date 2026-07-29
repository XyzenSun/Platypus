> ## Documentation Index
> Fetch the complete documentation index at: https://exa.ai/docs/llms.txt
> Primary API reference: https://exa.ai/docs/reference/get-contents
> Error codes reference: https://exa.ai/docs/reference/error-codes
> Best practices: https://exa.ai/docs/reference/contents-best-practices

# Exa Contents

Exa Contents 用于按 URL / id 获取页面正文、摘要和元数据。当前项目的 fetch adapter 使用它作为 `exa` 抓取 provider。

---

## 1. Endpoint

```http
POST https://api.exa.ai/contents
```

当前项目代码：

- Adapter：`src/providers/exa-fetch.ts`
- 常量默认值：`https://api.exa.ai/contents`
- 可选覆盖：`baseUrl` 会去掉末尾 `/` 后拼接 `/contents`

---

## 2. Auth

Exa API 支持 API key header，也支持 bearer。当前项目使用 `x-api-key`：

```http
x-api-key: EXA_API_KEY
Content-Type: application/json
```

当前项目对应关系：

```ts
headers: {
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
}
```

---

## 3. Request Body

官方 Contents API 可按 ids/URLs 获取内容，并可请求 text、summary、highlights、subpages、extras 等字段。和当前项目 fetch 相关的核心字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ids` | `string[]` | 要获取内容的 URL 或 Exa result id。当前项目传入单 URL 数组。 |
| `text` | `boolean \| object` | 是否返回正文文本；可传对象配置最大字符数等。 |
| `summary` | `boolean \| object` | 是否返回摘要。当前项目不请求。 |
| `highlights` | `boolean \| object` | 是否返回高亮信息。当前项目不请求。 |
| `livecrawl` / `livecrawlTimeout` | string / number | 控制缓存与实时抓取策略；当前项目不设置。 |

当前项目发送：

```json
{
  "ids": ["https://example.com/"],
  "text": { "maxCharacters": 5000 }
}
```

---

## 4. Success Response Fields

典型成功响应：

```json
{
  "requestId": "e492118ccdedcba5088bfc4357a8a125",
  "results": [
    {
      "id": "https://example.com/",
      "url": "https://example.com/",
      "title": "Example Domain",
      "text": "Example Domain\nThis domain is for use in illustrative examples...",
      "publishedDate": "2023-11-16T01:36:32.547Z",
      "author": "string"
    }
  ],
  "statuses": [
    {
      "id": "https://example.com/",
      "status": "success"
    }
  ],
  "costDollars": { "total": 0.001 }
}
```

字段说明：

| 字段 | 说明 | 当前项目是否使用 |
|---|---|---:|
| `requestId` | 支持排查用请求 ID | 否 |
| `results[].id` | Exa 结果 id / 输入 id | 否 |
| `results[].url` | 页面 URL | 是，映射到 `RawFetchResult.url` |
| `results[].title` | 页面标题 | 是，映射到 `RawFetchResult.title` |
| `results[].text` | 正文文本 | 是，映射到 `RawFetchResult.content` |
| `results[].publishedDate` | 发布时间 | 否 |
| `results[].author` | 作者 | 否 |
| `statuses[]` | 每个输入 URL/id 的成功或错误状态 | 仅失败时读取第一个 status 的 error tag |
| `costDollars` | 成本信息 | 否 |

当前项目成功映射：

```ts
return {
  url: first.url,
  title: first.title,
  content: first.text,
  format: 'text',
  fetchedAt: new Date().toISOString(),
};
```

注意：Exa `text` 返回纯文本，所以当前项目无论调用方请求 `markdown` 还是 `text`，都返回 `format: 'text'`。

---

## 5. Failure / Error Fields

### 5.1 Request-level HTTP errors

请求级错误通常用于认证、计费、验证、rate limit、服务端错误等。官方 error docs 包括：

| HTTP | 语义示例 |
|---:|---|
| 400 | bad request |
| 401 | invalid/missing API key |
| 402 | payment/credits |
| 403 | permission/content policy/robots 等请求级禁止 |
| 422 | validation error |
| 429 | rate limit |
| 500+ | 服务端错误 |

当前项目处理：非 OK 时读取 `res.text()`，用 `classifyHttpStatus(res.status)` 分类并抛 `ProviderError('exa', category, String(status), textOrStatusText)`。

### 5.2 Per-URL statuses errors

Exa Contents 的关键特性：`/contents` 对单个 URL 的抓取失败通常通过 `statuses[]` 返回，而不是整个 HTTP 请求失败。

示例：

```json
{
  "results": [],
  "statuses": [
    {
      "id": "https://example.com/private",
      "status": "error",
      "error": {
        "tag": "SOURCE_NOT_AVAILABLE",
        "httpStatusCode": 403
      }
    }
  ]
}
```

官方列出的内容抓取 status tags：

| Tag | HTTP Code | 说明 |
|---|---:|---|
| `CRAWL_NOT_FOUND` | 404 | 指定 URL 内容未找到。 |
| `CRAWL_TIMEOUT` | 504 | 抓取目标页面超时。 |
| `CRAWL_LIVECRAWL_TIMEOUT` | 504 | live crawl 在指定超时时间内未取回。 |
| `SOURCE_NOT_AVAILABLE` | 403 | 来源不可用、访问被禁止、可能需要认证或位于 paywall 后。 |
| `UNSUPPORTED_URL` | - | URL scheme 不支持。 |
| `CRAWL_UNKNOWN_ERROR` | 500+ | 其它抓取错误。 |

当前项目失败映射：

- 如果 `results[0]` 不存在或 `results[0].text` 缺失/为空：
  - 取 `statuses[0].error.tag`，否则使用 `NO_CONTENT`
  - 抛 `ProviderError('exa', 'QUOTA', tag, message)`
- 当前项目类型只声明了 `error.tag`，未保留 `error.httpStatusCode`。

---

## 6. Blocked / 401 / 403 / CDN / Anti-bot Signals

Exa 在四家中提供最强的结构化 per-URL 阻挡信号之一。

| 场景 | 可用信号 | 备注 |
|---|---|---|
| API key 错误 | request-level HTTP 401 | Exa API 认证失败。 |
| 额度/付款问题 | request-level HTTP 402 | 计费/credit 问题。 |
| 请求级禁止/robots | request-level HTTP 403，可能有 tag 如 `ROBOTS_FILTER_FAILED` | 可能是整批请求级阻断。 |
| 单 URL 访问禁止 | `statuses[].status='error'` + `error.tag='SOURCE_NOT_AVAILABLE'` + `httpStatusCode=403` | 最适合识别目标页 403 / paywall / access forbidden。 |
| 单 URL 404 | `CRAWL_NOT_FOUND` + `httpStatusCode=404` | 内容不存在。 |
| 单 URL 超时 | `CRAWL_TIMEOUT` / `CRAWL_LIVECRAWL_TIMEOUT` + 504 | 可重试或调整 live crawl 策略。 |
| 空内容 | `results[].text` 缺失/空，或无 result | 当前项目已视为错误抛出。 |
| CDN/Cloudflare/反爬 | 无 Cloudflare 专用布尔字段；可结合 `SOURCE_NOT_AVAILABLE`/403 或正文 challenge 文案判断 | 若 Exa 成功返回 challenge 页面文本，仍需内容启发式排除。 |

---

## 7. Current Adapter Relation

| 项目字段/行为 | Exa 字段/行为 |
|---|---|
| `provider id` | `exa` |
| endpoint | `POST /contents` |
| auth | `x-api-key: ${apiKey}` |
| body URL | `ids: [url]` |
| body content request | `text: { maxCharacters: 5000 }` |
| success URL | `results[0].url` |
| success title | `results[0].title` |
| success content | `results[0].text` |
| output format | 固定 `text` |
| per-URL failure | `statuses[0].error.tag` -> `ProviderError(..., tag, ...)` |
| timeout | 使用 `AbortSignal.timeout(params.timeoutMs)` |

---

## 8. Notes for Best-result Fetch

- Exa 已经在 adapter 内把无 `text` / 空 `text` 视为失败，符合“空内容不是成功”的方向。
- 后续如果要更准确识别 403/blocked，建议读取并保留 `statuses[].error.httpStatusCode` 至内部候选诊断，但是否进入统一 `RawFetchResult` 需另行设计。
- 如果 Exa 返回了非空 challenge 页面文本，仍需聚合层用内容特征排除。
