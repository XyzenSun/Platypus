# Research: Fetch provider success and blocking signals

- **Query**: Research how Firecrawl scrape, Jina Reader, Tavily Extract, and Exa Contents indicate success/failure and what fields are available for detecting blocked pages, empty content, HTTP 401/403, CDN/Cloudflare/anti-bot pages.
- **Scope**: mixed
- **Date**: 2026-07-29

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/providers/firecrawl-fetch.ts` | Firecrawl scrape fetch adapter; maps `success`, `data.markdown`, and `data.metadata` into `RawFetchResult`. |
| `src/providers/jina-fetch.ts` | Jina Reader fetch adapter; calls `r.jina.ai` with JSON accept and maps `data.title/content/url`. |
| `src/providers/tavily-fetch.ts` | Tavily Extract fetch adapter; uses `results` and `failed_results` to decide success/failure. |
| `src/providers/exa-fetch.ts` | Exa Contents fetch adapter; uses `results[].text` and `statuses[]` to decide success/failure. |
| `src/providers/fetch-types.ts` | Unified fetch result/warning types; only exposes `url`, `title`, `content`, `format`, and `fetchedAt` for results. |
| `src/aggregator/fetch.ts` | Aggregates per-provider fetch results and converts `ProviderError` failures to warnings with `provider`, `url`, `code`, `message`. |
| `.trellis/spec/backend/provider-conventions.md` | Local provider conventions: fetch adapters return only `RawFetchResult`; provider failures use `ProviderError`. |
| `.trellis/spec/backend/error-handling.md` | Local error categories: 401/402/403 are classified as `QUOTA`; 429/408/5xx/network are `NETWORK`; other 4xx are `USER_ERROR`. |

### Code Patterns

#### Unified result shape limits provider-specific signals

`src/providers/fetch-types.ts:8-14` defines the persisted successful payload shape:

```ts
export interface RawFetchResult {
  url: string;
  title?: string;
  content: string;
  format: 'markdown' | 'text';
  fetchedAt: string;
}
```

Provider-specific metadata such as upstream status code, provider error tag, Cloudflare marker, or extraction quality is not represented in the successful result type. Per-provider thrown errors are preserved only as warnings in `src/aggregator/fetch.ts:60-66` with `provider`, `url`, `code`, and `message`.

#### Firecrawl scrape

Local adapter behavior:

- `src/providers/firecrawl-fetch.ts:18-30` posts to `https://api.firecrawl.dev/v2/scrape` with `formats: ['markdown']` and `onlyMainContent: true`.
- `src/providers/firecrawl-fetch.ts:32-36` treats non-OK API HTTP responses as `ProviderError('firecrawl', classifyHttpStatus(res.status), String(res.status), bodyOrStatusText)`.
- `src/providers/firecrawl-fetch.ts:38-47` parses `success?: boolean`, `data.markdown`, and `data.metadata` with `title`, `sourceURL`, `url`, `statusCode`.
- `src/providers/firecrawl-fetch.ts:46-54` returns success even if `data.success` is false/absent or `markdown` is empty; content defaults to `''`.

External documented signals:

- Firecrawl scrape success response has top-level `success: true` and `data.markdown`, `data.html`, `data.metadata`.
- `data.metadata` can include `title`, `description`, `language`, `robots`, `sourceURL`, `statusCode`, and `contentType`.
- Error responses use top-level `success: false` and string `error`; some include optional `details` and `code`.
- Firecrawl v0/v1 schema references `metadata.pageStatusCode` and `metadata.pageError` for page-level status/error, while current feature docs show `metadata.statusCode`.
- Firecrawl v1 scrape options include `proxy: basic | enhanced | auto`; docs describe enhanced proxies for sites with advanced anti-bot solutions, but success detection still depends on response body/metadata rather than a dedicated “blocked” boolean.
- Firecrawl request-level 403 indicates API key lacks permission for endpoint/feature, not necessarily target-page 403; target-page status can appear in metadata when scrape itself returns 200.

Available detection fields from docs/API response:

| Signal | Field(s) |
|---|---|
| API success | top-level `success: true` |
| API failure | non-2xx HTTP plus `success: false`, `error`, optional `details`, `code` |
| Target HTTP status | `data.metadata.statusCode` or older `metadata.pageStatusCode` |
| Target page error | older `metadata.pageError` |
| Empty extraction | missing/empty `data.markdown`/requested format |
| Block/CND/anti-bot page | no dedicated field found; infer from `metadata.statusCode` 401/403/429/5xx and content/title/html markers if returned |

#### Jina Reader

Local adapter behavior:

- `src/providers/jina-fetch.ts:15-23` calls `https://r.jina.ai/<url>` with `Accept: application/json`, `X-Return-Format: params.format`, and `X-Engine: direct`.
- `src/providers/jina-fetch.ts:27-31` treats non-OK Reader API HTTP responses as `ProviderError('jina', classifyHttpStatus(res.status), String(res.status), bodyOrStatusText)`.
- `src/providers/jina-fetch.ts:33-44` expects JSON `data.title`, `data.content`, `data.url`; content defaults to `''` and is returned as success.

External documented signals:

- Reader API supports response formats via `Accept`, including `application/json`, `text/json`, `text/plain`, and event stream.
- JSON response sample has `{ "code": 200, "status": 20000, "data": ..., "meta": null }`; Jina’s Reader landing page describes JSON containing URL, title, content, and timestamp when available.
- Docs list request/API response status classes: 200, 400, 401, 402, 403, 409, 413, 422, 429, 451, 500, 503.
- `X-Assert-Status-Code` can assert the crawled page’s HTTP status; if actual target status does not match, Reader rejects with 422.
- Jina states Reader does not actively bypass anti-bot/access controls; if a site blocks Reader, that outcome is respected.
- Jina README troubleshooting specifically names “bot challenges, geo blocks, stale CDN edges” and mentions Cloudflare-related blocking in linked issue search results. It describes knobs such as API key, `x-no-cache`, `x-engine: browser`, and proxy headers, but does not expose a dedicated response field for “Cloudflare blocked”.

Available detection fields from docs/API response:

| Signal | Field(s) |
|---|---|
| API success | HTTP 200 plus JSON `code`/`status` success and populated `data` |
| API failure/auth/quota | HTTP 401/402/403/429/etc. with error response body |
| Target HTTP status | not directly documented as a normal response field; can use `X-Assert-Status-Code` to force mismatch into 422 |
| Empty extraction | missing/empty `data.content` or empty plain-text response |
| Block/CND/anti-bot page | no dedicated field found; infer from HTTP error, 422 assertion mismatch, or content/title text such as Cloudflare/challenge pages if returned |

#### Tavily Extract

Local adapter behavior:

- `src/providers/tavily-fetch.ts:23-35` posts to `/extract` with `urls: [url]`, `format: params.format`, and `extract_depth: 'basic'`.
- `src/providers/tavily-fetch.ts:37-41` treats non-OK Tavily API HTTP responses as `ProviderError('tavily', classifyHttpStatus(res.status), String(res.status), bodyOrStatusText)`.
- `src/providers/tavily-fetch.ts:43-52` parses `results?: { url, raw_content }[]` and `failed_results?: { url, error }[]`; if no result exists, it throws `ProviderError('tavily', 'USER_ERROR', 'NO_RESULTS', failureErrorOrDefault)`.
- `src/providers/tavily-fetch.ts:55-60` returns success with `content: first.raw_content ?? ''`, so an empty `raw_content` in a successful result becomes successful empty content.

External documented signals:

- Tavily Extract top-level response fields are `results`, `failed_results`, `response_time`, and `request_id`; some best-practice docs also mention optional `usage` when requested.
- Each successful result has `url`, `raw_content`, optional `images`, and optional `favicon`.
- Each failed result has `url` and `error` explaining why it could not be processed.
- `extract_depth: advanced` is documented as higher-latency but higher success rate; `basic` is default.
- The docs found do not list a structured target `httpStatusCode` field for failed results; failure detail is a string `error`.

Available detection fields from docs/API response:

| Signal | Field(s) |
|---|---|
| API success | HTTP 200 with target URL in `results[]` |
| Per-URL failure | target URL in `failed_results[]` with `error` string |
| Request-level failure/auth/quota | non-2xx HTTP response, including 401/403/etc. where applicable |
| Target HTTP status | no structured field found; may be embedded in `failed_results[].error` if Tavily includes it |
| Empty extraction | successful result with missing/empty `raw_content` |
| Block/CDN/anti-bot page | no dedicated field found; infer from `failed_results[].error` text or returned `raw_content`/page title if challenge content is extracted |

#### Exa Contents

Local adapter behavior:

- `src/providers/exa-fetch.ts:23-34` posts to `/contents` with `ids: [url]` and `text: { maxCharacters: 5000 }`.
- `src/providers/exa-fetch.ts:36-40` treats non-OK request-level HTTP responses as `ProviderError('exa', classifyHttpStatus(res.status), String(res.status), bodyOrStatusText)`.
- `src/providers/exa-fetch.ts:42-45` parses `results?: { id, url, title, text }[]` and `statuses?: { id, status, error?: { tag } }[]`.
- `src/providers/exa-fetch.ts:47-57` treats missing result or missing text as failure, using `statuses[0].error.tag` or `NO_CONTENT` as code and throwing `ProviderError('exa', 'QUOTA', tag, message)`.
- `src/providers/exa-fetch.ts:60-66` returns `format: 'text'` regardless of caller request.

External documented signals:

- Exa Contents returns HTTP 200 even when individual URLs fail; per-URL success/failure appears in `statuses`.
- Response fields include `requestId`, `results`, `statuses`, and `costDollars`.
- Result fields include `id`, `title`, `url`, `publishedDate`, `author`, `text`, `highlights`, `highlightScores`, `summary`, `subpages`, and `extras.links`, depending on requested options.
- `statuses[].status` is `"success"` or `"error"`.
- `statuses[].error.tag` and `statuses[].error.httpStatusCode` give structured per-URL errors.
- Per-URL content fetch status tags include:
  - `CRAWL_NOT_FOUND` with HTTP 404.
  - `CRAWL_TIMEOUT` with HTTP 504.
  - `CRAWL_LIVECRAWL_TIMEOUT` with HTTP 504.
  - `SOURCE_NOT_AVAILABLE` with HTTP 403, described as access forbidden or source unavailable.
  - `UNSUPPORTED_URL` with no HTTP code.
  - `CRAWL_UNKNOWN_ERROR` with HTTP 500+.
- Request-level errors include 400 bad request, 401 invalid/missing API key, 402 payment/credits, 403 permission/content policy/robots in some cases, 422 validation, and 429 rate limit. Error response structure includes `requestId`, `error`, and `tag`.
- Exa error docs also list `ROBOTS_FILTER_FAILED` for `/contents` request-level 403 when all requested URLs were blocked by robots.txt, and `NO_CONTENT_FOUND` for no contents found.

Available detection fields from docs/API response:

| Signal | Field(s) |
|---|---|
| API/request success | HTTP 200 plus `requestId` |
| Per-URL success | `statuses[].status === 'success'` and matching result in `results[]` |
| Per-URL failure | `statuses[].status === 'error'`, `statuses[].error.tag`, `statuses[].error.httpStatusCode` |
| Target HTTP 403/block | `statuses[].error.tag === 'SOURCE_NOT_AVAILABLE'` and `httpStatusCode: 403` |
| Request auth/quota/permission | request-level HTTP 401/402/403/429 with JSON `tag` and `error` |
| Empty extraction | missing/empty `results[].text` when `text` requested; request-level `NO_CONTENT_FOUND` or per-URL error status may appear depending on case |
| Block/CDN/anti-bot page | no Cloudflare-specific field found; infer from `SOURCE_NOT_AVAILABLE`/403 or extracted text/title if a challenge page is returned as content |

### External References

- [Firecrawl Scrape feature docs](https://docs.firecrawl.dev/features/scrape) — shows successful scrape response shape with `success`, `data.markdown`, and `data.metadata.statusCode`.
- [Firecrawl error docs](https://docs.firecrawl.dev/api-reference/errors) — documents non-2xx error shape with `success: false`, `error`, optional `details`/`code`, and request-level 403 meaning.
- [Firecrawl v0 scrape API reference](https://docs.firecrawl.dev/v0/api-reference/endpoint/scrape) — documents older `metadata.pageStatusCode` and `metadata.pageError` fields.
- [Jina Reader API docs](https://r.jina.ai/docs) — documents response formats, API status codes, and `X-Assert-Status-Code` behavior.
- [Jina Reader landing page](https://jina.ai/reader/) — states Reader respects access controls and does not actively bypass anti-bot protections.
- [Jina Reader README](https://github.com/jina-ai/reader/blob/main/README.md) — documents headers and troubleshooting language for bot challenges, geo blocks, stale CDN edges, browser/proxy/cache behavior.
- [Tavily Extract API reference](https://docs.tavily.com/documentation/api-reference/endpoint/extract) — documents `results`, `failed_results`, successful `raw_content`, and failed `error` fields.
- [Tavily Python SDK reference](https://docs.tavily.com/sdk/python/reference) — includes Extract response object and successful/failed result field tables.
- [Tavily Extract help article](https://help.tavily.com/articles/8721959612-what-is-the-tavily-extract-api) — confirms response format and failed result structure.
- [Exa Contents API reference](https://exa.ai/docs/reference/get-contents) — documents `/contents` response with `results`, `statuses`, and result fields.
- [Exa Contents API guide for coding agents](https://exa.ai/docs/reference/contents-api-guide-for-coding-agents) — documents response fields and per-URL `statuses[].error.tag/httpStatusCode`.
- [Exa Error Codes](https://exa.ai/docs/reference/error-codes) — documents request-level and content-fetch status tags including `SOURCE_NOT_AVAILABLE`, `ROBOTS_FILTER_FAILED`, and `NO_CONTENT_FOUND`.
- [Exa Contents Retrieval](https://exa.ai/docs/reference/contents-retrieval) — documents crawl error semantics and `statuses` handling.

### Related Specs

- `.trellis/spec/backend/provider-conventions.md` — fetch adapter interface and convention that adapters return normalized `RawFetchResult` only.
- `.trellis/spec/backend/error-handling.md` — `ProviderError`, `classifyHttpStatus`, and aggregator warning behavior.
- `.trellis/spec/backend/quality-guidelines.md` — required patterns for external HTTP calls and provider failures.

## Caveats / Not Found

- No provider documentation found exposes a dedicated, structured `isCloudflare`, `isAntiBot`, `blockedByCdn`, or equivalent boolean.
- Firecrawl and Exa expose the strongest structured target-status signals: Firecrawl via metadata status fields, Exa via per-URL `statuses[].error.httpStatusCode` and tags.
- Tavily Extract exposes per-URL failure via `failed_results[].error`, but the docs found do not guarantee a structured target HTTP status code.
- Jina Reader exposes API HTTP errors and can assert expected target status with `X-Assert-Status-Code`, but normal target HTTP status is not documented as a standard JSON field in the searched docs.
- Local adapters currently do not preserve many documented upstream detection fields in successful `RawFetchResult`; provider-specific details are mostly discarded unless they are represented as thrown warning code/message.
