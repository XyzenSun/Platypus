# Platypus

聚合搜索 MCP 服务器，为 AI Agent 提供统一的搜索和网页抓取能力。

## 功能

提供 3 个 MCP 工具：

| 工具 | 说明 |
|------|------|
| `list` | 列出当前可用的 Provider 及其能力 |
| `search` | 并发调用多个搜索引擎，用 RRF 算法融合排序结果 |
| `fetch` | 并发抓取 URL 内容，返回多个 Provider 的结果视图 |

## 支持的 Provider

| 类型 | Provider |
|------|---------|
| 搜索 | Tavily、Exa、Gemini AI |
| 抓取 | Firecrawl、Jina Reader、Tavily Extract、Exa Contents |

## 安装与运行

```bash
npm install
npm run build
```

通过 stdio 与 MCP 客户端连接：

```bash
node dist/index.js
```

## 环境变量

复制 `.env.example` 并按需填写 API Key：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `TAVILY_API_KEY` | Tavily 搜索 |
| `EXA_API_KEY` | Exa 搜索 / 抓取 |
| `GEMINI_API_KEY` | Gemini AI 搜索 |
| `JINA_API_KEY` | Jina Reader 抓取 |
| `FIRECRAWL_API_KEY` | Firecrawl 抓取 |
| `SEARXNG_BASE_URL` | SearXNG 自托管地址 |

## 架构

```
MCP Client
    │
    ▼
Tools (list / search / fetch)
    │
    ▼
Aggregator（并发 + RRF 融合）
    │
    ▼
Providers（Tavily / Exa / Gemini / Jina / Firecrawl）
```

**RRF 评分**：`score = Σ 1/(k + rank)`，k=60，URL 规范化去重，内容取最长。评分策略通过 `ScoringStrategy` 接口可插拔。

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
