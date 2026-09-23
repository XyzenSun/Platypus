# SearXNG 调用排查

缺少 `PLATYPUS_SEARXNG_BASE_URL` 时检查 `--env` 或系统环境；设置为实例根地址而非 `/search`，CLI 自行追加路径。403 常见原因是实例在 `settings.yml` 中禁用了 JSON 输出；需要实例管理员启用，不要靠修改查询词绕过。连接错误还需检查本机能否访问地址、代理及实例状态。

`--format` 如指定只能为 `json`；输出为 HTML 或非 200 时检查实例 JSON 格式设置。`--q` 不可用，使用 `--query`。上游失败看 stderr，不执行 AI。公共实例的配置和速率限制可能不同，`platypus list` 不会检测这些行为。
