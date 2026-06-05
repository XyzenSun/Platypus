# Directory Structure

```
src/
  index.ts               # Entry: loadConfig → createServer → server.connect(stdio)
  config/
    types.ts             # ProviderId union, Config interface
    env.ts               # loadConfig() — reads env vars, returns Config
  server/
    server.ts            # createServer(): registers list/search/fetch MCP tools
    logger.ts            # log() — writes to stderr
  tools/
    schemas.ts           # Zod schemas: ListInputSchema, SearchInputSchema, FetchInputSchema
    list.ts / search.ts / fetch.ts  # MCP tool handlers
  providers/
    types.ts             # PROVIDER_CAPABILITIES, DEFAULT_FETCH_PRIORITY
    registry.ts          # buildRegistry(), getSearchProviders(), getFetchProviders()
    search-types.ts      # SearchProvider interface, SearchResult, NormalizedSearchParams
    fetch-types.ts       # FetchProvider interface, RawFetchResult, NormalizedFetchParams
    tavily.ts / exa.ts / gemini.ts           # search adapters
    tavily-fetch.ts / jina-fetch.ts / exa-fetch.ts / firecrawl-fetch.ts  # fetch adapters
  aggregator/
    scoring-types.ts     # ScoringStrategy interface, ProviderRanked type
    search.ts            # aggregateSearch()
    fetch.ts             # aggregateFetch()
    strategies/
      rrf.ts             # RrfScoringStrategy (default, k=60)
      gemini-boost.ts    # GeminiBoostScoringStrategy
  lib/
    errors.ts            # ProviderError, classifyHttpStatus(), classifyError()
    retry.ts             # withRetry()
    url.ts               # normalizeUrl()
    ai-clients/
      types.ts           # AIClient interface
      gemini.ts          # GeminiAIClient (implemented)
      openai.ts          # stub (PR6)
      anthropic.ts       # stub (PR6)
```

## Import Conventions

All imports use `.js` extension (NodeNext module resolution). Type-only imports use `import type`. No barrel `index.ts` files — import directly from the source file.

```typescript
// correct
import type { SearchProvider } from './search-types.js';
import { withRetry } from '../lib/retry.js';

// wrong — missing .js, or using a barrel index
import { withRetry } from '../lib/retry';
```

## Adding a New Provider

1. Add to `ProviderId` union in `src/config/types.ts`.
2. Add entry to `PROVIDER_CAPABILITIES` in `src/providers/types.ts`.
3. Add `isConfigured` case in `src/providers/registry.ts`.
4. Add instantiation in `getSearchProviders()` or `getFetchProviders()` in `src/providers/registry.ts`.
5. Add env var reading in `src/config/env.ts`.
