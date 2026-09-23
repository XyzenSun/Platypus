# Jina 调用排查

缺少 `PLATYPUS_JINA_API_KEY` 时检查系统环境或 `--env` 指定文件；`platypus list` 不会访问 Jina。401/403 先核对 key 与权限，429 核对额度；非 200 仅在 stderr 报错，不启动 AI。

当前 adapter 固定请求 `Accept: application/json` 和 `GET /search`。如果期待 Reader 独立读取端点或纯 Markdown 响应，这是功能范围不匹配，不要通过 `--query` 塞 URL 假装 CLI 已支持读取。`--q` 不可用，请用 `--query`；参数错误查 `platypus search jina --help`。
