# Firecrawl 调用排查

缺少 `PLATYPUS_FIRECRAWL_API_KEY` 时检查 `--env` 或系统环境；401/403 检查 key 和套餐权限，429 检查配额。BASE_URL 应是服务根地址而非 `/v2/search` 完整路径，CLI 会自行追加端点。

如果只有标题、URL 与描述而没有页面 Markdown，先检查是否传了 `--scrapeOptions`；未传时不抓取正文。如果上游报告参数错误，检查 `scrapeOptions` 与 `categories` 是否为合法 JSON，数组和对象需要正确引用。HTTP 非 200 报错在 stderr，AI 不会运行。
