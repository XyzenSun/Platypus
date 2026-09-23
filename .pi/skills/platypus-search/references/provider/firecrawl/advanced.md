# Firecrawl v2 Search API 说明

adapter 调用 `POST https://api.firecrawl.dev/v2/search`，用 `PLATYPUS_FIRECRAWL_API_KEY` Bearer 认证；`PLATYPUS_FIRECRAWL_BASE_URL` 可覆盖域名根地址，不要包含 `/v2/search`。CLI 的 `--query` 直接发送 JSON `query`；其他参数原样加入 JSON body，数组、对象用 JSON 字符串传入。

请求字段：`query` 必填，文档最长 500 字符；`limit` 默认 10、范围 1-100，多个来源时按来源类型计数；`country` 如 `US`，`location` 可指定更精细的地理位置。`includeDomains` 与 `excludeDomains` 是主机名数组，不可同时用。`categories` 为类别对象数组，例如 `[{"type":"research"}]`、`[{"type":"github"}]`、`[{"type":"pdf"}]`；不要当作字符串数组。`sources` 是数据源对象数组，默认 web，可选 web/images/news，web 项可带 `tbs`；`tbs` 支持时间过滤与排序。`scrapeOptions` 是抓取选项对象，传 `{"formats":[{"type":"markdown"}]}` 才请求正文；`ignoreInvalidURLs`、`timeout` 等选项需按官方 API 使用，`enterprise` 需要套餐支持。内容抓取与多个源可能增加费用和结果大小。

```bash
platypus search firecrawl --query "ML papers" --categories '[{"type":"research"}]' --limit 5
platypus search firecrawl --query "search API" --limit 2 --scrapeOptions '{"formats":[{"type":"markdown"}]}'
```

响应一般有 `success`、`data`、`creditsUsed`、`id`；`data` 中有 `web`、`news`、`images` 等与请求源对应的数组。CLI 不重组为统一结果，也不提供 title-only。`scrapeOptions` 的全部子字段、响应 schema、类别及错误说明请查 [Firecrawl 官方搜索文档](https://docs.firecrawl.dev/features/search) 和 [官方文档索引](https://docs.firecrawl.dev/llms.txt)；当前 CLI 未接入独立抓取端点。
