# SearXNG `GET /search` API 说明

adapter 调用 `GET <PLATYPUS_SEARXNG_BASE_URL>/search`，把 CLI `--query` 映射为 `q` 并强制 `format=json`；无需通用 API key，但实例可能另行设置访问限制。其他选项透传为 URL 查询参数。实例必须启用 JSON 输出，否则通常会返回 403。`platypus list` 只判断地址有值。

参数：`q` 必填，可包含目标搜索引擎支持的查询语法；`categories` 与 `engines` 是逗号分隔的列表，值取决于实例启用的项目；`language` 是语言代码，`pageno` 默认为 1；`time_range` 为 `day`、`month`、`year`，具体引擎可能不支持；`safesearch` 为实例支持的安全搜索级别。`format` 在 CLI 中只能为 `json`，不能设置为 CSV/RSS。其他如 `autocomplete`、`image_proxy`、`enabled_plugins`、`disabled_plugins` 的行为受实例配置影响，不能跨实例保证。这个 API 没有标准的最大结果数或 title-only 请求参数。

```bash
platypus search searxng --query "TypeScript" --engines google,bing --language en --pageno 2
platypus search searxng --query "Node.js" --categories general --time_range month
```

JSON 响应可包含 `query`、`number_of_results`、`results` 与相关分类、引擎信息；结果内容依实例和引擎不同。检查端点、参数与服务器格式配置时看 [SearXNG 官方 Search API 文档](https://docs.searxng.org/dev/search_api.html) 与实例的 `settings.yml`；当前 CLI 不提供 POST 或其他响应格式。
