# Tavily `/search` API 说明

adapter 调用 `POST https://api.tavily.com/search`，使用 `PLATYPUS_TAVILY_API_KEY` Bearer 认证，可用 `PLATYPUS_TAVILY_BASE_URL` 覆盖根地址。CLI `--query` 对应必填 JSON `query`，其余字段沿用 Tavily 名称；对象和数组需 JSON 字符串。

请求字段：`search_depth` 可为 `ultra-fast`、`fast`、`basic`（默认）或 `advanced`（增加延迟和费用）；`chunks_per_source` 仅 advanced 生效。`max_results` 文档默认 5、范围 0-20；`topic` 为 `general`、`news`、`finance`；`time_range` 为 day/week/month/year 或缩写；`start_date`、`end_date` 为 YYYY-MM-DD。`country` 使用英文国家名，只适用 general，表示偏好而非严格过滤。`include_domains`、`exclude_domains` 为数组。`include_answer` 接布尔值或 `basic`/`advanced`；`include_raw_content` 接布尔值或 `markdown`/`text`，会增加结果内容。`include_images`、`include_image_descriptions`、`include_favicon` 控制附加内容。`auto_parameters`、`exact_match`、`include_usage`、`safe_search` 等高级开关的组合与取值应查官方参考，不假设可和其他 Provider 通用。

```bash
platypus search tavily --query "API release" --topic news --time_range week --max_results 5
platypus search tavily --query "TypeScript" --search_depth advanced --include_raw_content markdown --include_domains '["typescriptlang.org"]'
```

原始响应通常含 `query`、`results`、`answer`、`images`、`response_time`、`request_id`，每条结果可含 `title`、`url`、`content`、`score`、`raw_content` 等。CLI 不实现 title-only 响应转换。查字段完整 schema、费用、错误状态及最新取值时看 [Tavily 官方文档索引](https://docs.tavily.com/llms.txt) 的 Search API 参考；当前 CLI 仅封装 `/search`。
