# Platypus 项目约定

本目录是项目根目录。`src/` 包含入口、Provider、配置和 AI 处理代码；`doc/UpstreanAPIFormat/` 保存各 Provider 的上游 API 资料；`README.md` 说明项目用法，`TODO.md` 记录任务。旧版 MCP 的 `src/` 已删除；CLI 正在实现中，文档不得把尚未验证或发布的能力写成已发布。

## 工作流程

开始项目任务时先阅读 `README.md` 了解现状，再阅读 `TODO.md`；经用户批准修改文件后，按实际进展在 `TODO.md` 记录、更新任务，避免把未完成事项写成已完成。涉及上游 API 细节时才阅读 `doc/UpstreanAPIFormat/` 中对应资料，并以官方 API 为准。

## 重构目标

项目由 Node.js / TypeScript、ESM 实现，已从 MCP 服务器改为 CLI。npm 包名为 `platypus-cli`，可执行命令为 `platypus`；构建产物带可执行入口，本地安装可运行 `platypus search exa ...`。当前适配 Exa、Tavily、Jina、Brave、Firecrawl、Gemini、Ollama、SearXNG；新加入的 Provider 尚待真实 API 验证，npm 发布也尚未完成。

CLI 包装器只识别自身选项和 Provider 名称，例如 `platypus --ai --prompt "清洗要求" search exa --query "关键词"`；包装器只解析 `search` 之前的 `--env`、`--ai`、`--prompt`。Provider 名称后的参数不由包装器解析或校验，而是原样传给对应 adapter。每个 adapter 独立定义该厂商的命令、参数、鉴权、API 调用和响应处理；更新一家 Provider 应主要修改其 adapter，而不要求修改包装器的命令解析逻辑。普通搜索命令只统一搜索词名称 `query`，由各 adapter 映射到上游的 `query` 或 `q`；其余参数沿用各家 API 的名称和语义。Gemini Grounding 的 CLI `query` 只映射为该家模型输入 `contents`，不假装它返回普通搜索结果；对于 Parallel 的 `search_queries` 数组等不同语义，不强行套用 `query`。保留各家官方 API 的响应差异，不再为多 Provider 并发调用建立统一搜索入参或结果模型，也不继续以 RRF 融合为 CLI 的默认流程。

AI 清洗支持 OpenAI Chat Completions、Anthropic Messages 和 Gemini；协议实现放在 `src/ai/client/`，`src/ai/clean.ts` 只负责提示词和按格式动态分发。Gemini 搜索 adapter 动态调用 `src/ai/client/gemini.ts`，与 Gemini AI 共用协议客户端但分别读取配置。不要在入口或非 AI 搜索路径静态导入 AI SDK，以免加载无关依赖。Gemini AI 暂只支持非流式，`PLATYPUS_AI_STREAMBLE=true` 只影响 OpenAI 与 Anthropic。不开启 `--ai` 时输出上游原始 JSON 文本；开启时输出清洗后的纯文本，可用 `--prompt` 替换默认提示词。AI 失败时将错误和完整原始响应写入 `/tmp/platypus-error-<provider>-<本地毫秒时间戳>.json`，stdout 仅输出文件路径提示，退出码为 1；上游非 200 不调用 AI。所有配置变量使用 `PLATYPUS_` 前缀，优先读取 `--env` 指定的文件，缺失时回退系统环境变量，不自动查找其他 `.env`。黑白名单暂不实现，保留在 `TODO.md`。

## 开发命令

项目使用 Node.js >=20。`npm run build` 使用 tsup 生成 ESM 可执行入口，`npm run typecheck` 检查类型，`npm run lint` 执行 Biome 检查。发布前还需使用真实凭据验证上游调用和 AI 行为，并验证 npm 全局安装；修改和测试前遵循全局规则，先说明范围并取得用户批准。
