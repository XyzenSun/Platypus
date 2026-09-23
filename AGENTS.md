# Platypus 项目约定

本目录是项目根目录。`src/` 包含入口、Provider、配置和 AI 处理代码；`doc/UpstreanAPIFormat/` 保存各 Provider 的上游 API 资料；`README.md` 说明项目用法，`TODO.md` 记录任务。当前代码与 README 仍描述旧版 MCP 聚合搜索，以下 CLI 架构是重构目标，不能误认为已经实现。

## 工作流程

开始项目任务时先阅读 `README.md` 了解现状，再阅读 `TODO.md`；经用户批准修改文件后，按实际进展在 `TODO.md` 记录、更新任务，避免把未完成事项写成已完成。涉及上游 API 细节时才阅读 `doc/UpstreanAPIFormat/` 中对应资料，并以官方 API 为准。

## 重构目标

项目由 Node.js / TypeScript、ESM 实现，从 MCP 服务器改为 CLI。目标 npm 包名为 `platypus-cli`，发布后的可执行命令为 `platypus`；构建产物应带可执行入口，支持安装后直接运行 `platypus exa search ...`。首批迁移 Exa、Tavily、Jina，其余 Provider 的迁移另行确认。

CLI 包装器只识别自身选项和 Provider 名称，例如 `platypus --ai exa search ...`；Provider 名称后的命令与参数不由包装器解析或校验，而是原样传给对应 adapter。每个 adapter 独立定义该厂商的命令、参数、鉴权、API 调用和响应处理；更新一家 Provider 应主要修改其 adapter，而不要求修改包装器的命令解析逻辑。普通搜索命令只统一搜索词名称 `query`，由各 adapter 映射到上游的 `query` 或 `q`；其余参数沿用各家 API 的名称和语义。对于 Parallel 的 `search_queries` 数组、Gemini Grounding 的模型输入等不同语义，不强行套用 `query`。保留各家官方 API 的响应差异，不再为多 Provider 并发调用建立统一搜索入参或结果模型，也不继续以 RRF 融合为 CLI 的默认流程。

AI 清洗由包装器选项控制，是 Provider 调用之后的可选处理阶段；不开启时输出 Provider 的原始结果。AI 处理与具体 Provider 的命令参数解耦，复用现有 AI 客户端能力时避免依赖旧聚合结果类型。保留域名黑白名单机制作为结果处理能力，不把它耦合到跨 Provider 融合流程；目前代码只实现黑名单，白名单规则与其在 CLI 中的应用方式待实现前确认。AI 输出格式、失败回退等尚未确定的行为在实现前与用户确认。

## 开发命令

当前项目使用 Node.js >=20。现有 `npm run build` 使用 tsup 生成 ESM 可执行入口，`npm run typecheck` 检查类型，`npm run lint` 执行 Biome 检查；迁移时同步维护 `package.json` 的包名、`bin` 和构建入口，以及 `README.md` 的安装和使用示例。上述命令描述的是现有脚本，CLI 的实际安装与运行须在实现后验证。修改和测试前遵循全局规则，先说明范围并取得用户批准。
