# Platypus CLI

Platypus 是按 Provider 独立调用的搜索 CLI，可选用 AI 清洗结果。本仓库正在迁移为 npm 包 `platypus-cli`；旧版已发布的 `@xyzensun/platypus-mcp` 仍是不同的 MCP 产品，新的 CLI 尚未发布到 npm。

## 本地使用

需要 Node.js >=20。在仓库中安装依赖、构建并运行：

```bash
npm ci
npm run build
node dist/index.js search exa --query "Node.js" --numResults 5
node dist/index.js --ai search tavily --query "Node.js" --max_results 5
node dist/index.js --ai --prompt "只保留关键事实和来源链接" search jina --query "Node.js" --num 5
```

构建后也可通过 `npm link` 在本机使用 `platypus` 命令。发布 `platypus-cli` 后，用户可通过 `npm install -g platypus-cli` 安装并直接运行 `platypus search exa ...`。仓库构建成功不等于 npm 已发布。

`platypus [--env <文件>] [--ai] [--prompt <文本>] search <provider> ...` 的包装器只识别 `search` 之前的选项及 Provider 名称，Provider 后面的选项完全交给对应 adapter。首批支持 `exa`、`tavily`、`jina`；使用 `platypus --help` 和 `platypus search exa --help` 查看分层帮助。普通搜索只统一 `--query` 名称，其余选项使用上游 API 的字段名：Exa 如 `--numResults`、`--contents '{"text":true}'`；Tavily 如 `--max_results`、`--include_domains '["example.com"]'`；Jina 如 `--num`、`--type`。数组与对象选项请传入 JSON 字符串；不同厂商的参数不做跨平台语义转换。

## 输出

不加 `--ai` 时 stdout 输出上游返回的原始 JSON 文本，不统一响应结构。加 `--ai` 后 stdout 只输出 AI 清洗后的纯文本；`--prompt` 替换默认清洗要求，系统提示和 user prompt 都会包含该要求，搜索词和原始响应一起发送给 AI。AI 支持 OpenAI Chat Completions 和 Anthropic Messages 协议。默认非流式；`PLATYPUS_AI_STREAMBLE=true` 时使用对应官方 SDK 的流式接口，等待 SDK 聚合完整响应后再输出正文，不逐块打印。

上游 HTTP 状态不是 200 时，stderr 输出状态及响应，退出码为 1，且不调用 AI。AI 失败时，把错误原因与完整原始上游响应写入权限受限的 `/tmp/platypus-error-<provider>-<YYYYMMDDHHmmssSSS>.json`（本地时间，精确到毫秒），stdout 仅输出 `AI处理失败，原始响应与AI错误原因见<文件路径>`，退出码为 1。黑白名单尚未实现。

## 配置

CLI 的 `--env <文件>` 必须写在 `search` 之前；不指定时仅使用系统环境变量。指定文件中的变量优先，同名变量不存在时才回退系统环境变量。不自动读取工作目录或可执行文件附近的 `.env`。变量名统一带 `PLATYPUS_` 前缀：

```text
PLATYPUS_EXA_API_KEY
PLATYPUS_TAVILY_API_KEY
PLATYPUS_JINA_API_KEY
PLATYPUS_AI_FORMAT=openai 或 anthropic
PLATYPUS_AI_API_KEY
PLATYPUS_AI_MODEL
PLATYPUS_AI_BASE_URL（可选；OpenAI 可填 host 或以 /v1 结尾的地址，CLI 将末段路径替换为 /v1；Anthropic 地址原样交给 SDK）
PLATYPUS_AI_STREAMBLE=true（可选，只有 true 启用流式，默认非流式）
PLATYPUS_AI_MAX_TOKENS=8192（可选，Anthropic 输出 token 上限，按模型能力调整）
```

各 Provider 可选 `PLATYPUS_<PROVIDER>_BASE_URL`；填写域名根地址，CLI 会追加 `/search`。示例见 [`.env.example`](.env.example)。不要提交含真实密钥的文件。

开发检查：`npm run typecheck`、`npm run build`、`npm run lint`。后续计划见 [`TODO.md`](TODO.md)，Provider 的本地 API 资料见 `doc/UpstreanAPIFormat/`。
