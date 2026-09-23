# Brave 调用排查

缺少 `PLATYPUS_BRAVE_API_KEY` 时核对 `--env` 和系统环境；`list` 只检查是否非空。401/403 优先核对订阅 key、套餐和可选 BASE_URL 是否为服务根地址；CLI 自行追加 `/res/v1/web/search`，不要把端点写进 BASE_URL。429 时检查配额或速率限制。

URL 参数使用 Brave 自己的名字，如 `count`、`country`、`search_lang`；不要传其他 Provider 的 `max_results`。上游 HTTP 错误输出 stderr，不调用 AI。运行 `platypus search brave --help` 查看高频示例。
