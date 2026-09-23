---
name: platypus-search
description: "Aggregated multi-engine web search via the Platypus MCP server (Tavily, Exa, Brave, Jina, SearXNG, Firecrawl, Gemini, Ollama). Use when you need web search, news, or research results that are deduplicated and ranked across multiple providers, or when a single search engine is rate-limited, unavailable, or missing API keys."
---

# Platypus Aggregated Search

Use this skill to run web searches through the Platypus MCP server. Platypus fans a query out to several search providers concurrently, merges the results with RRF (Reciprocal Rank Fusion), post-processes scores (provider weights + domain blacklist), and returns one deduplicated ranked list.

## Prerequisites

The Platypus MCP server must be available to the client. Either:

- **npm (recommended)** — no clone needed:
  ```bash
  npx -y @xyzensun/platypus-mcp
  ```
- **From source**:
  ```bash
  npm install && npm run build
  node dist/index.js
  ```

At least one provider API key must be configured; any provider without a key is silently skipped. Check `.env.example` (or the repo README) for the full list: `TAVILY_API_KEY`, `EXA_API_KEY`, `BRAVE_API_KEY`, `JINA_API_KEY`, `FIRECRAWL_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_API_KEY`, and `SEARXNG_BASE_URL` (self-hosted, no key).

## Tools

### `list`

Lists the providers that are currently configured and available. Call this first when unsure which channels will work.

- Input: none.
- Returns: `{ "providers": ["tavily", "exa", ...] }`.

### `search`

Runs an aggregated search across all (or selected) configured providers.

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `query` | string (1–400) | — | Required. Search keywords. |
| `mode` | `BasicAggregation` \| `AIAggregation` | `BasicAggregation` | `AIAggregation` runs an extra AI cleanup pass for cleaner context. |
| `channels` | string[] | all configured | Usually leave unset; only set to restrict providers. |
| `hasContent` | boolean | `true` | When true, returns full page content; when false, only URL + title. |
| `perChannelMaxResults` | int (1–50) | `10` | Max results taken from each provider. |
| `includeDomains` | string | — | Comma-separated allow-list of domains. |
| `excludeDomains` | string | — | Comma-separated deny-list of domains. |
| `publishedAfter` | `YYYY-MM-DD` | — | Only results after this date. |
| `publishedBefore` | `YYYY-MM-DD` | — | Only results before this date. |
| `topic` | `common` \| `news` \| `finance` | `common` | Search topic. |
| `language` | `zh_cn` \| `us_en` | — | Preferred result language. |
| `region` | `US` \| `CN` \| `GB` \| `DE` \| `FR` \| `JP` \| `CA` | — | Preferred result region. |
| `searchEffort` | `low` \| `medium` \| `high` | `medium` | Search depth. |
| `timeoutMs` | int (1000–120000) | `60000` | Per-channel timeout. |
| `minScore` | number | — | Keep only results with `score >= minScore`. |
| `maxRank` | int (>=1) | — | Keep only results with `rank <= maxRank`. |

Each returned result has: `id`, `title`, `url`, optional `content`, `score`, `rank`, `sources` (which providers contributed), and optional `publishedDate`.

The response shape is `{ "results": [...], "warnings": [...] }`. On failure it returns `{ "error": "...", "warnings": [...] }` (e.g. `ALL_PROVIDERS_FAILED`).

## Usage Guidance

- **Prefer leaving `channels` unset** so all configured providers contribute; more sources means better fusion.
- **For agent context**, consider `hasContent: false` when you only need links/titles, and `maxRank`/`minScore` to trim the result set.
- **`minScore` and `maxRank` combine as an intersection** — a result must satisfy both to be returned.
- **`mode: AIAggregation`** costs an extra AI call (needs `AI_API_KEY`) but yields cleaner, more focused results.
- **Filtering by source** is best done with `includeDomains` / `excludeDomains` rather than post-filtering in the client.
- A built-in domain blacklist is always applied server-side; results from blacklisted domains never appear.

## Example

Basic search for MCP news:

```json
{ "query": "Anthropic Model Context Protocol", "topic": "news", "perChannelMaxResults": 5 }
```

Restricted to a few domains, links only, top 3:

```json
{ "query": "TypeScript SDK best practices", "includeDomains": "github.com,typescriptlang.org", "hasContent": false, "maxRank": 3 }
```
