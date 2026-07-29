> ## Documentation Index
> Primary API docs: https://r.jina.ai/docs
> API guide reference: https://docs.jina.ai/fundamentals/flow/
> Reader landing page: https://jina.ai/reader/

# Jina Reader API

Jina Reader (`r.jina.ai`) 用于读取单个网页并返回适合 LLM 使用的内容。当前项目的 fetch adapter 使用它作为 `jina` 抓取 provider。

注意：`doc/UpstreanAPIFormat/jina/search.md` 记录的是 Jina Search (`s.jina.ai`)；本文件记录当前 fetch 使用的 Reader (`r.jina.ai`)。

---

## 1. Endpoint

常用 GET 形式：

```http
GET https://r.jina.ai/{targetUrl}
```

示例：

```bash
curl "https://r.jina.ai/https://example.com/" \
  -H "Accept: application/json" \
  -H "X-Return-Format: markdown"
```

官方也提供 POST JSON 形式：

```http
POST https://r.jina.ai/
Content-Type: application/json

{
  "url": "https://example.com/"
}
```

当前项目代码：

- Adapter：`src/providers/jina-fetch.ts`
- 常量默认值：`https://r.jina.ai/`
- 当前使用 GET，把目标 URL 直接拼在 `https://r.jina.ai/` 后面。

---

## 2. Auth

```http
Authorization: Bearer YOUR_JINA_TOKEN
```

Jina Reader 可使用 Bearer token。当前项目要求配置 api key 并发送 Authorization header：

```ts
headers: {
  Authorization: `Bearer ${apiKey}`,
  Accept: 'application/json',
  'X-Return-Format': params.format,
  'X-Engine': 'direct',
}
```

---

## 3. Request Headers / Parameters

和当前 fetch 相关的常用 header：

| Header | 说明 | 当前项目是否使用 |
|---|---|---:|
| `Authorization` | `Bearer {YOUR_JINA_TOKEN}` | 是 |
| `Accept` | 响应格式；支持 `application/json` / `text/json` / `text/plain` / `text/event-stream` | 是，固定 `application/json` |
| `X-Return-Format` | 返回内容格式：`markdown`、`html`、`text`、`screenshot`、`pageshot` 等 | 是，来自 `params.format` |
| `X-Engine` | 抓取引擎：`browser`、`direct`、`cf-browser-rendering` | 是，固定 `direct` |
| `X-Timeout` | 页面加载超时，秒 | 否；项目使用 `AbortSignal.timeout` |
| `X-Assert-Status-Code` | 断言目标页面 HTTP 状态码；不匹配时返回 422 | 否 |
| `X-No-Cache` | 禁用缓存，强制新抓取 | 否 |
| `X-Target-Selector` | 聚焦指定 CSS selector | 否 |
| `X-Wait-For-Selector` | 等待指定元素出现 | 否 |
| `X-Proxy` / `X-Proxy-Url` | 使用官方或自定义代理 | 否 |

当前项目请求示例：

```bash
curl "https://r.jina.ai/https://example.com/" \
  -H "Authorization: Bearer YOUR_JINA_TOKEN" \
  -H "Accept: application/json" \
  -H "X-Return-Format: markdown" \
  -H "X-Engine: direct"
```

---

## 4. Success Response Fields

`Accept: application/json` 时，Reader 返回 JSON envelope。常见结构：

```json
{
  "code": 200,
  "status": 20000,
  "data": {
    "title": "Example Domain",
    "url": "https://example.com/",
    "content": "# Example Domain\n\nThis domain is for use in illustrative examples...",
    "description": "string",
    "publishedTime": "string",
    "metadata": {}
  },
  "meta": null
}
```

字段说明：

| 字段 | 说明 | 当前项目是否使用 |
|---|---|---:|
| `code` | HTTP 状态码镜像，成功通常为 200 | 否 |
| `status` | Jina 内部状态码，成功示例为 20000 | 否 |
| `data.title` | 页面标题 | 是，映射到 `RawFetchResult.title` |
| `data.url` | 页面 URL | 是，缺失时回退到输入 URL |
| `data.content` | 根据 `X-Return-Format` 返回的正文 | 是，映射到 `RawFetchResult.content` |
| `data.description` | 描述 | 否 |
| `data.metadata` | 元数据 | 否 |
| `meta` | 附加元信息 | 否 |

当前项目成功映射：

```ts
return {
  url: data.data?.url ?? url,
  title: data.data?.title,
  content: data.data?.content ?? '',
  format: params.format,
  fetchedAt: new Date().toISOString(),
};
```

注意：当前 adapter 对 `content` 为空字符串仍返回 fulfilled；后续 best-result 聚合应将空内容视为无效候选。

---

## 5. Failure / Error Fields

官方 docs 列出 Reader API 可能返回的状态类包括：

| HTTP | 语义示例 |
|---:|---|
| 400 | 请求格式错误 |
| 401 | 未认证 / token 缺失或错误 |
| 402 | 付款/额度问题 |
| 403 | 权限禁止 |
| 409 | 冲突 |
| 413 | 请求过大 |
| 422 | 参数校验失败；例如 `X-Assert-Status-Code` 与目标页实际状态不一致 |
| 429 | rate limit |
| 451 | 因法律原因不可用 |
| 500 / 503 | 服务端错误 |

当前项目处理：非 OK 时读取 `res.text()`，用 `classifyHttpStatus(res.status)` 分类并抛 `ProviderError('jina', category, String(status), textOrStatusText)`。

---

## 6. Blocked / 401 / 403 / CDN / Anti-bot Signals

Jina Reader 文档没有暴露专用 `isBlocked` / `isCloudflare` 字段。Jina 说明 Reader 不主动绕过访问控制；如果站点阻挡 Reader，该结果应被尊重。

可用信号：

| 场景 | 可用信号 | 备注 |
|---|---|---|
| API token 错误 | request-level HTTP 401 | Jina API 认证失败。 |
| 额度/权限问题 | HTTP 402/403 | API 或资源权限层面。 |
| rate limit | HTTP 429 | 可重试/降速。 |
| 目标状态断言失败 | 设置 `X-Assert-Status-Code` 后返回 HTTP 422 | 当前项目未使用；可用于测试目标页是否实际 200。 |
| 空抽取 | `data.content` 缺失或空字符串 | 当前 adapter 会返回空内容；聚合层需二次判定。 |
| CDN/Cloudflare/反爬 | HTTP 错误、422 断言失败、或 `data.title/content` 中出现 challenge/blocked 文案 | 无结构化字段。 |
| Cloudflare/JS-heavy 页面 | 可尝试 `X-Engine: browser` 或 `cf-browser-rendering` | 当前项目固定 `direct`，偏速度不偏成功率。 |

---

## 7. Current Adapter Relation

| 项目字段/行为 | Jina Reader 字段/行为 |
|---|---|
| `provider id` | `jina` |
| endpoint | `GET https://r.jina.ai/{url}` |
| auth | `Authorization: Bearer ${apiKey}` |
| response format | `Accept: application/json` |
| return format | `X-Return-Format: params.format` |
| engine | 固定 `X-Engine: direct` |
| success URL | `data.url ?? input url` |
| success title | `data.title` |
| success content | `data.content ?? ''` |
| output format | `params.format` |
| timeout | 使用 `AbortSignal.timeout(params.timeoutMs)` |

---

## 8. Notes for Best-result Fetch

- Jina 当前 adapter 对空内容不抛错，因此 best-result 聚合必须将空内容视为失败候选。
- Jina 没有稳定的目标 HTTP status 字段；如果后续需要更明确的状态判断，可实测 `X-Assert-Status-Code: 200` 的误差和副作用。
- 对 JS-heavy / Cloudflare 页面，可实测 `X-Engine: browser` 或 `cf-browser-rendering`，但这会改变延迟和可用性，应单独决策。
