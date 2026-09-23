# Tavily 调用排查

出现缺少 `PLATYPUS_TAVILY_API_KEY` 时，确认已传 `--env <文件>` 或系统环境变量。`platypus list` 只证明变量有值，不代表账号有额度。

上游非 200 时 CLI 将响应写入 stderr，不执行 AI；401/403 优先检查 key 与权限，429 核对配额及速率限制。若参数不被接受，用 `platypus search tavily --help` 或官方 `/search` 文档核对字段名：Tavily 使用 `max_results`、`search_depth`、`include_domains`，不要套用 Exa 的驼峰字段。数组用合法 JSON，如 `--include_domains '["example.com"]'`。
