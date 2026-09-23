# Ollama Web Search 调用排查

缺少 `PLATYPUS_OLLAMA_API_KEY` 时检查 `--env` 或系统环境。401/403 核对 Ollama Cloud key、账号权限及是否访问云端服务，而非本地 `ollama serve`；429 查额度和速率限制。BASE_URL 应为服务根地址，CLI 会追加 `/api/web_search`。

上游非 200 报错只在 stderr，AI 不运行；参数错误核对 `--max_results`（不是 `--numResults`）与官方范围。`platypus search ollama --help` 可查看当前 CLI 支持的高频参数。
