# Gemini Grounding 请求说明

Gemini 搜索不是普通搜索 API：adapter 调用官方 `@google/genai` 的 `models.generateContent`，`contents` 设为 CLI `--query`，`config.tools` 固定为 `[{"googleSearch":{}}]`；`PLATYPUS_GEMINI_API_KEY` 创建客户端，可选 `PLATYPUS_GEMINI_BASE_URL` 作为 SDK httpOptions.baseUrl。CLI 只接受 `--query` 与 `--model`；模型优先级为 `--model`、`PLATYPUS_GEMINI_MODEL`、`gemini-flash-lite-latest`。搜索 key 与 AI 清洗的 `PLATYPUS_AI_API_KEY` 独立。

```bash
platypus search gemini --query "核验最近发布的 Node.js 版本并列出来源" --model gemini-2.5-flash-lite
```

此端点的工具让模型自行决定是否搜索，不保证每个请求都有 Grounding 数据。响应为 SDK 完整对象的 JSON 序列化，通常包含 `candidates`、`modelVersion`、`usageMetadata`；候选回答在 `content.parts`，有实际检索时可见 `groundingMetadata.webSearchQueries`、`groundingChunks` 与 `groundingSupports`，用于对应回答与网页来源。CLI 没有“最大结果数”“地区”“只标题”或其他生成配置选项，也不强制模型只返回搜索条目。

模型、工具兼容和引用展示义务可能变化；需要完整 Google Search Grounding 协议、响应结构和当前支持的模型时查 [Google 官方 Grounding 文档](https://ai.google.dev/gemini-api/docs/google-search) 和 [模型列表](https://ai.google.dev/gemini-api/docs/models)。其他 Gemini API 能力不等于当前 CLI 已提供。
