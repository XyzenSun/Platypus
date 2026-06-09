# Platypus

聚合搜索 MCP 服务器，为 AI Agent 提供统一的搜索和网页抓取能力。

## 功能

提供 3 个 MCP 工具：

| 工具 | 说明 |
|------|------|
| `list` | 列出当前可用的 Provider 及其能力 |
| `search` | 并发调用多个搜索引擎，先做 RRF 融合，再做统一的 score 后处理与域名黑名单过滤 |
| `fetch` | 并发抓取 URL 内容，返回多个 Provider 的结果视图 (优化中 暂不支持)   |

## 支持的 Provider

| 类型 | Provider |
|------|---------|
| 搜索 | Tavily、Exa、Brave、Jina、SearXNG、Firecrawl、Gemini AI |
| 抓取 | Firecrawl、Jina Reader、Tavily Extract、Exa Contents |

说明：并非所有 Provider 同时支持搜索与抓取，具体以 `list` 工具返回的当前可用能力为准。

## 快速开始（推荐：npm 包）

无需 clone 仓库，直接通过 npm 拉取已发布的版本：

[![npm version](https://img.shields.io/npm/v/@xyzensun/platypus-mcp.svg)](https://www.npmjs.com/package/@xyzensun/platypus-mcp)

### 在 MCP 客户端中配置

在你的 MCP 客户端配置文件（如 Claude Desktop 的 `claude_desktop_config.json`、Cursor 的 MCP 设置）中加入：

```json
{
  "mcpServers": {
    "platypus": {
      "command": "npx",
      "args": ["-y", "@xyzensun/platypus-mcp"],
      "env": {
        "TAVILY_API_KEY": "your-tavily-key",
        "EXA_API_KEY": "your-exa-key",
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

按需填写所需 Provider 的 API Key，未配置的 Provider 会自动跳过。完整环境变量见下文 [环境变量](#环境变量)。

### 直接通过 npx 运行

也可以在终端直接启动 stdio server：

```bash
npx -y @xyzensun/platypus-mcp
```

或全局安装后调用 `platypus-mcp` 命令：

```bash
npm install -g @xyzensun/platypus-mcp
platypus-mcp
```

### 通过 mcp-cli 调试 npm 包

```bash
npx @wong2/mcp-cli --pass-env npx -y @xyzensun/platypus-mcp
```

---

## 从源码构建（开发者路径）

```bash
npm install
npm run build
```

通过 stdio 与 MCP 客户端连接：

```bash
node dist/index.js
```

## 通过 mcp-cli 使用（源码方式）

如果你想用 `mcp-cli` 在本地交互式调试或以脚本方式调用本 MCP 服务，建议先将本项目 clone 到本地并完成构建。

### 交互式连接本地 stdio MCP server

```bash
git clone <repo-url>
cd Platypus
npm install
npm run build
npx @wong2/mcp-cli node dist/index.js
```

如果服务依赖当前 shell 中的环境变量，可以改用：

```bash
npx @wong2/mcp-cli --pass-env node dist/index.js
```

### 非交互式调用本地 stdio MCP server

先在项目根目录创建一个最小 `config.json`：

```json
{
  "mcpServers": {
    "platypus": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

然后使用 `call-tool` 调用本项目真实工具名。例如调用 `list`：

```bash
git clone <repo-url>
cd Platypus
npm install
npm run build
npx @wong2/mcp-cli -c config.json call-tool platypus:list
```

调用 `search` 并传入参数：

```bash
npx @wong2/mcp-cli -c config.json call-tool platypus:search --args '{"query":"Anthropic MCP","limit":5}'
```

## 环境变量

复制 `.env.example` 并按需填写 API Key：

```bash
cp .env.example .env
```

其中 `EXA_BASE_URL` 与 `TAVILY_BASE_URL` 是可选项，只填写根路径即可；未设置时会继续使用默认官方地址。

| 变量 | 说明 |
|------|------|
| `TAVILY_API_KEY` | Tavily 搜索 / 抓取 |
| `TAVILY_BASE_URL` | Tavily API 根路径，可选，例如 `https://api.tavily.com` |
| `EXA_API_KEY` | Exa 搜索 / 抓取 |
| `EXA_BASE_URL` | Exa API 根路径，可选，例如 `https://api.exa.ai` |
| `GEMINI_API_KEY` | Gemini AI 搜索 |
| `JINA_API_KEY` | Jina Reader 抓取 |
| `FIRECRAWL_API_KEY` | Firecrawl 抓取 |
| `SEARXNG_BASE_URL` | SearXNG 自托管地址 |
| `SEARCH_PROVIDER_WEIGHTS` | 搜索结果后处理的渠道权重，格式为 `provider:value`，多个值用逗号分隔，例如 `exa:1.5,gemini:0.7` |
| `DOMAIN_BLACKLIST_URL` | 域名黑名单下载地址，可选；未设置时使用内置默认 raw URL |

## Search 排序与域名策略

`search` 的排序流程：

1. 先做基础 RRF 融合、URL 规范化去重和内容合并。
2. 再做统一 post-processing，包括：
   - 按渠道权重调整 `score`
   - 重新排序并重算 `rank`
   - 按域名黑名单过滤结果

`SEARCH_PROVIDER_WEIGHTS` 未设置时，所有渠道默认权重为 `1`，整体排序语义保持与原先接近。

域名黑名单源文件位于 `src/config/domain-blacklist.txt`，用途是维护默认黑名单列表。文件格式为纯文本：

- 一行一个域名
- 支持空行
- 支持以 `#` 开头的注释行

黑名单匹配采用父域匹配：如果黑名单中包含 `example.com`，则 `example.com`、`www.example.com` 以及更深层子域都会命中。命中后结果会直接从最终 `search` 返回中移除，不参与最终排序输出。

## 架构

```
MCP Client
    │
    ▼
Tools (list / search / fetch)
    │
    ▼
Aggregator（并发 + RRF 融合 + score 后处理 + 域名黑名单过滤）
    │
    ▼
Providers（Tavily / Exa / Gemini / Jina / Firecrawl）
```

**RRF 评分**：`score = Σ 1/(k + rank)`，k=60，URL 规范化去重，内容取最长。基础融合完成后，聚合层还会继续执行统一的 score post-processing（provider weights + domain blacklist filtering）。评分策略通过 `ScoringStrategy` 接口可插拔。

## 开发

```bash
npm run dev        # watch 模式
npm run test       # 单元测试
npm run test:e2e   # E2E 测试（需配置 API Key）
npm run lint       # Biome 检查
npm run typecheck  # TypeScript 类型检查
```

## 技术栈

TypeScript · ESM · `@modelcontextprotocol/sdk` · Zod · Vitest · Biome
