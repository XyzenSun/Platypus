---
name: platypus-search
description: 使用 Platypus CLI 从 Exa、Tavily、Jina、Brave、Firecrawl、Gemini、Ollama 或 SearXNG 选择合适的提供商进行联网搜索，可选 AI 清洗。当用户要求查找最新资料、网页搜索、检索来源时使用；无需联网时不要触发。
compatibility: 需要 Node.js >=20、已安装的 platypus 命令、相应提供商凭据或 SearXNG 实例及网络连接。
---

# Platypus 搜索

## 安装和检验

npm 发布后可用 `npm install -g platypus-cli` 安装；目前未发布，不要声称已可安装。运行 `platypus --help` 检验；`platypus [--env <文件>] list` 列出已配置的提供商，不检测连通性。不擅自安装或修改凭据；程序故障可查源码（随 npm 包发布尚待落实）。

## 当前程序的提供商

源码支持 `exa`、`tavily`、`jina`、`brave`、`firecrawl`、`gemini`、`ollama`、`searxng`；与 `list` 的已配置列表不同。按任务选一家，不默认并发。

## 各个提供商的特点

Exa：语义检索；Tavily：结构化网页结果；Brave：通用网页搜索；Firecrawl：可抓取正文；Jina：当前 CLI 仅支持搜索；Ollama：云端 Web Search；SearXNG：自托管；Gemini Grounding：模型综合回答，非独立网页结果列表。仅作选择线索，不保证质量或连通性。

## AI 用法和异常排查

运行 `platypus [--env <文件>] --ai [--prompt <要求>] search <provider> --query "关键词"`；包装器选项须在 `search` 前。默认输出上游 JSON；`--ai` 输出纯文本，需配置 `PLATYPUS_AI_FORMAT`、`PLATYPUS_AI_API_KEY`、`PLATYPUS_AI_MODEL`。AI 失败且 stdout 给出 `/tmp/platypus-error-*.json` 路径时，读 [AI 排障](references/ai-troubleshooting.md)；文件含完整原始响应，勿公开转贴。上游失败只看 stderr 和退出码，不把错误当搜索结果。

## 各个提供商的用法

选定一家后，仅读对应的高频文件：[Exa](references/provider/exa/common.md)、[Tavily](references/provider/tavily/common.md)、[Jina](references/provider/jina/common.md)、[Brave](references/provider/brave/common.md)、[Firecrawl](references/provider/firecrawl/common.md)、[Gemini](references/provider/gemini/common.md)、[Ollama](references/provider/ollama/common.md)、[SearXNG](references/provider/searxng/common.md)。该家调用失败时读 `references/provider/<名称>/troubleshooting.md`；需要该家已接入端点的完整 API 说明、响应结构或官方文档入口时读 `references/provider/<名称>/advanced.md`。所有路径相对于本 skill 根目录；不要为找资料读取其他提供商文件。除 `--query` 外不统一字段；核验结论时查原始来源。
