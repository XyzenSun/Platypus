> ## Documentation Index
> Fetch the complete documentation index at: https://docs.firecrawl.dev/llms.txt
> Primary API reference: https://docs.firecrawl.dev/api-reference/endpoint/scrape
> Feature guide: https://docs.firecrawl.dev/features/scrape
> Error guide: https://docs.firecrawl.dev/api-reference/errors

# Firecrawl Scrape

Firecrawl Scrape 用于抓取单个 URL，并返回 Markdown、HTML、metadata 等格式化内容。当前项目的 fetch adapter 使用它作为 `firecrawl` 抓取 provider。

---

## 1. Endpoint

```http
POST https://api.firecrawl.dev/v2/scrape
```

当前项目代码：

- Adapter：`src/providers/firecrawl-fetch.ts`
- 常量默认值：`https://api.firecrawl.dev/v2/scrape`
- 当前没有 fetch adapter 级 `baseUrl` 覆盖。

---

## 2. Auth

```http
Authorization: Bearer fc-YOUR-API-KEY
Content-Type: application/json
```

当前项目对应关系：

```ts
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
}
```

---

## 3. Request Body

官方 `/scrape` 请求体由 `url` 加 `ScrapeOptions` 组成。核心字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `url` | `string` | 要抓取的目标 URL。 |
| `formats` | `string[] \| object[]` | 输出格式，默认 `['markdown']`；支持 `markdown`、`html`、`rawHtml`、`links`、`images`、`summary` 等。 |
| `onlyMainContent` | `boolean` | 是否只提取页面主体内容。 |
| `includeTags` / `excludeTags` | `string[]` | 包含/排除指定标签。 |
| `headers` | `object` | 传给目标站点的自定义请求头。 |
| `waitFor` / `actions` | number / array | 等待或执行页面操作后再抓取。 |
| `timeout` | `number` | 抓取超时。 |
| `proxy` | `basic \| enhanced \| auto` | 代理策略；增强代理可用于更复杂的反爬场景，成本更高。 |
| `mobile` | `boolean` | 是否模拟移动端。 |
| `location` | `object` | 地理位置/语言设置。 |

当前项目发送：

```json
{
  "url": "https://example.com/",
  "formats": ["markdown"],
  "onlyMainContent": true
}
```

当前项目无论调用方请求 `markdown` 还是 `text`，都要求 Firecrawl 返回 Markdown，并在成功结果中标记 `format: 'markdown'`。

---

## 4. Success Response Fields

官方 cURL 返回 payload 示例：

```json
{
  "success": true,
  "data": {
    "markdown": "Launch Week I is here! ...",
    "html": "<!DOCTYPE html><html ...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "robots": "follow, index",
      "sourceURL": "https://firecrawl.dev",
      "url": "https://www.firecrawl.dev/",
      "statusCode": 200,
      "contentType": "text/html"
    }
  }
}
```

字段说明：

| 字段 | 说明 | 当前项目是否使用 |
|---|---|---:|
| `success` | 请求是否成功 | 读取类型中声明，但当前未判断 false |
| `data.markdown` | Markdown 正文 | 是，映射到 `RawFetchResult.content` |
| `data.html` / `data.rawHtml` | HTML 内容 | 否 |
| `data.metadata.title` | 页面标题 | 是，映射到 `RawFetchResult.title` |
| `data.metadata.sourceURL` | 发起请求的原始 URL | 是，优先映射到 `RawFetchResult.url` |
| `data.metadata.url` | 跟随重定向后的最终 URL | 是，作为 `sourceURL` 缺失时的备选 |
| `data.metadata.statusCode` | 目标页面 HTTP 状态码 | 当前未使用，但对 401/403/blocked 判定很重要 |
| `data.metadata.contentType` | 目标内容类型 | 否 |
| `data.metadata.robots` | robots meta | 否 |

当前项目成功映射：

```ts
return {
  url: metadata.sourceURL ?? metadata.url ?? url,
  title: metadata.title,
  content: data.data?.markdown ?? '',
  format: 'markdown',
  fetchedAt: new Date().toISOString(),
};
```

注意：当前 adapter 对 `success: false`、`metadata.statusCode` 非 2xx、`markdown` 空字符串均不会主动抛错；后续 best-result 聚合应统一做有效性判定。

---

## 5. Failure / Error Fields

### 5.1 Request-level HTTP errors

官方 `/scrape` OpenAPI 中典型错误包括：

| HTTP | 语义 | 响应字段示例 |
|---:|---|---|
| 402 | Payment required | `error` |
| 429 | Too many requests | `error` |
| 500 | Server error | `success: false`, `code`, `error` |

Firecrawl error docs 还说明非 2xx 错误通常包含：

```json
{
  "success": false,
  "error": "string",
  "details": "optional",
  "code": "optional"
}
```

当前项目处理：非 OK 时读取 `res.text()`，用 `classifyHttpStatus(res.status)` 分类并抛 `ProviderError('firecrawl', category, String(status), textOrStatusText)`。

### 5.2 Target-page status / scrape-level failure

目标站点状态通常不会表现为 Firecrawl API 的 HTTP status，而是可能出现在：

- `data.metadata.statusCode`（当前 v2 文档）
- `metadata.pageStatusCode` / `metadata.pageError`（旧版文档中出现）
- `data.markdown` / `data.html` 中的阻挡页内容

当前项目尚未使用这些字段进行失败判定。

---

## 6. Blocked / 401 / 403 / CDN / Anti-bot Signals

官方文档没有提供统一的 `isBlocked` / `isCloudflare` 布尔字段。

可用信号：

| 场景 | 可用信号 | 备注 |
|---|---|---|
| API key / 权限问题 | request-level HTTP 401/403/402/429 等 | 这是 Firecrawl API 访问问题，不一定是目标站点阻挡。 |
| 目标页 401/403/429 | `data.metadata.statusCode` | 当前 adapter 未保留；后续可作为候选有效性判断输入。 |
| 旧版页面错误 | `metadata.pageStatusCode` / `metadata.pageError` | 研究中发现旧文档提及。 |
| 空抽取 | `data.markdown` 缺失或空字符串 | 当前 adapter 会返回空内容；聚合层需二次判定。 |
| CDN/Cloudflare/反爬 | `metadata.statusCode`、`metadata.error/pageError`、或 markdown/html/title 中的 challenge 文案 | 无专用字段，只能结合状态码和内容启发式判断。 |

---

## 7. Current Adapter Relation

| 项目字段/行为 | Firecrawl 字段/行为 |
|---|---|
| `provider id` | `firecrawl` |
| endpoint | `POST /v2/scrape` |
| auth | `Authorization: Bearer ${apiKey}` |
| body URL | `url` |
| formats | 固定 `['markdown']` |
| main content | 固定 `onlyMainContent: true` |
| success URL | `data.metadata.sourceURL ?? data.metadata.url ?? input url` |
| success title | `data.metadata.title` |
| success content | `data.markdown ?? ''` |
| output format | 固定 `markdown` |
| target status | `data.metadata.statusCode`，当前未使用 |
| timeout | 使用 `AbortSignal.timeout(params.timeoutMs)`，不是 Firecrawl body 的 `timeout` 字段 |

---

## 8. Notes for Best-result Fetch

- Firecrawl 的 `metadata.statusCode` 对排除 401/403/429、登录页、CDN 盾很有价值，当前 adapter 没有保留。
- 在业务代码未改前，空 markdown 会被当作 fulfilled result；best-result 聚合必须把空内容视为无效候选。
- 如果后续要实测提升阻挡站点成功率，可对比 `proxy: 'enhanced'` / `auto`，但这涉及成本变化，应单独决策。
