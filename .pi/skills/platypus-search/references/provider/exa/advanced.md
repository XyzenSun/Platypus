# Exa `/search` API 说明

当前 adapter 调用 `POST https://api.exa.ai/search`，用 `PLATYPUS_EXA_API_KEY` 作为 `x-api-key`，`PLATYPUS_EXA_BASE_URL` 可覆盖根地址。CLI `--query` 映射 JSON `query`；其他 `--字段 值` 进入 JSON body。数组、对象以合法 JSON 字符串传入；不把输出转换为统一结构。

请求字段：`query` 必填；`numResults` 为结果数（文档默认 10、公开上限 100，不同 type 可能不同）；`type` 可为 `auto`、`instant`、`fast`、`deep-lite`、`deep`、`deep-reasoning`；`category` 可选 `news`、`research paper`、`company`、`people`、`financial report`、`personal site` 等，但 company/people 对日期和域名过滤有限制。`includeDomains`、`excludeDomains` 为域名数组；`startPublishedDate`、`endPublishedDate` 按发布日期筛选，`startCrawlDate`、`endCrawlDate` 按爬取日期筛选，均使用 ISO 8601。`userLocation` 为两字符国家代码，`moderation` 为布尔值。`additionalQueries` 仅深度搜索可用。`contents` 是可选对象，可选 `text`、`highlights`、`summary`、`extras` 等；`context` 已弃用。`outputSchema`、`systemPrompt` 用于合成输出；`stream` 可能改用 SSE，**当前 CLI 只读取完整响应正文，不提供流式事件解析，因此不要启用**。其他企业字段以官方文档为准。

```bash
platypus search exa --query "LLM research" --numResults 5 --type auto --contents '{"highlights":true}'
platypus search exa --query "AI news" --startPublishedDate 2025-01-01T00:00:00.000Z --includeDomains '["example.com"]'
```

原始响应通常包含 `requestId`、`resolvedSearchType`、`results`、`searchTime`、`costDollars`，结果可含 `title`、`url`、`text`、`highlights` 等，取决于请求。不保证仅返回标题。需查询每个字段的完整类型、默认值、错误码及最新限制时，阅读 [Exa 官方文档索引](https://exa.ai/docs/llms.txt) 和其 `/search` API 参考；不要把 `/answer` 等未接入端点当作当前命令。
