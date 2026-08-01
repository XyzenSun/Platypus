# Directory Structure

```
src/
  index.ts               # Entry: loadConfig → createServer → server.connect(stdio)
  config/
    types.ts             # ProviderId union, Config interface
    env.ts               # loadConfig() — reads env vars, returns Config
  server/
    server.ts            # createServer(): registers list/search MCP tools
    logger.ts            # log() — writes to stderr
  tools/
    schemas.ts           # Zod schemas: ListInputSchema, SearchInputSchema
    list.ts / search.ts  # MCP tool handlers
  providers/
    search-types.ts      # SearchProvider interface, SearchResult, NormalizedSearchParams
    search-provider-utils.ts  # Shared compile/normalize helpers
    registry.ts          # buildRegistry() -> { providers }, getSearchProviders()
    CLAUDE.md            # Directory-local conventions for adding adapters
    tavily.ts / exa.ts / gemini.ts / brave.ts / jina.ts
    firecrawl.ts / searxng.ts / ollama.ts   # search adapters
  aggregator/
    scoring-types.ts     # ScoringStrategy interface, ProviderRanked type
    search.ts            # aggregateSearch()
    ai-aggregation.ts    # AI cleanup pass (mode=AIAggregation)
    strategies/
      rrf.ts             # RrfScoringStrategy (default, k=60)
      gemini-boost.ts    # GeminiBoostScoringStrategy
      post-process.ts    # score post-processing (provider weights + domain blacklist)
  lib/
    errors.ts            # ProviderError, classifyHttpStatus(), classifyError()
    retry.ts             # withRetry()
    url.ts               # normalizeUrl()
    ai-clients/
      types.ts           # AIClient interface
      gemini.ts          # GeminiAIClient (implemented)
      openai.ts          # stub
      anthropic.ts       # stub
```

> **Removed in 0.0.x**: `src/tools/fetch.ts`, `src/aggregator/fetch.ts`, `src/providers/fetch-types.ts`, `src/providers/types.ts` (formerly `PROVIDER_CAPABILITIES` / `DEFAULT_FETCH_PRIORITY`), and the four `*-fetch.ts` adapter files were deleted when the fetch tool was deprecated. Do not recreate these paths unless reintroducing a fetch-shaped capability — and if you do, design the capability map fresh instead of restoring the legacy shape.

## Import Conventions

All imports use `.js` extension (NodeNext module resolution). Type-only imports use `import type`. No barrel `index.ts` files — import directly from the source file.

```typescript
// correct
import type { SearchProvider } from './search-types.js';
import { withRetry } from '../lib/retry.js';

// wrong — missing .js, or using a barrel index
import { withRetry } from '../lib/retry';
```

## Adding a New Search Provider

1. Add to `ProviderId` union in `src/config/types.ts`.
2. Add `isConfigured` case + `getSearchProviders()` instantiation in `src/providers/registry.ts`, and append the id to `ALL_PROVIDERS`.
3. Add env var reading in `src/config/env.ts`.
4. Add unit coverage in `tests/unit/registry.test.ts` (configuration filter) and `tests/unit/search-adapters.test.ts` (request mapping).

> The legacy step "Add entry to `PROVIDER_CAPABILITIES` in `src/providers/types.ts`" is gone — that file was deleted along with the capability map. Capability tracking was dropped because every retained provider is search-only. If a future provider reintroduces a non-search capability, recreate a capability map at that point (designed around the new capability, not the legacy fetch shape).
