# Ollama Web Search API 说明

adapter 调用云端 `POST https://ollama.com/api/web_search`，使用 `PLATYPUS_OLLAMA_API_KEY` Bearer 认证；`PLATYPUS_OLLAMA_BASE_URL` 可覆盖服务根地址。CLI 把选项组成 JSON body，不调用本地 `ollama serve`。

此端点仅有必填 `query`（字符串）与可选 `max_results`（整数，官方文档默认 5、最大 10）；当前不支持地区、语言、高亮、title-only 筛选、模型参数。CLI 不将查询改造成其他 Provider 的字段。

```bash
platypus search ollama --query "Node.js official documentation" --max_results 5
```

响应 JSON 的 `results` 数组包含 `title`、`url`、`content` 摘录。要只展示标题可在 CLI 之外解析原始 JSON，但不能误称 CLI 提供该请求能力。查询完整认证方法、字段类型、响应实例、限额与最新变更时看 [Ollama 官方 Web Search 文档](https://docs.ollama.com/capabilities/web-search) 与 [官方索引](https://docs.ollama.com/llms.txt)；`/api/web_fetch` 未接入。
