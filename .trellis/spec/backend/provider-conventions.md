# Provider Conventions

## Interfaces

Search providers implement `SearchProvider` (`src/providers/search-types.ts`):

```typescript
interface SearchProvider {
  id: string;
  search(params: NormalizedSearchParams): Promise<RawProviderResult[]>;
}
```

Fetch providers implement `FetchProvider` (`src/providers/fetch-types.ts`):

```typescript
interface FetchProvider {
  id: string;
  fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult>;
}
```

## Adapter Pattern

Each adapter is a class that takes API credentials in the constructor and implements one interface. See `src/providers/tavily.ts` as the canonical search adapter example and `src/providers/jina-fetch.ts` for a fetch adapter.

Key rules for every adapter:

- Store the API key as a private `readonly` field.
- Wrap the HTTP call in `withRetry`.
- Use `AbortSignal.timeout(params.timeoutMs)` for every fetch call.
- On non-OK response: call `classifyHttpStatus(res.status)` and throw `ProviderError`.
- Return `RawProviderResult[]` (search) or `RawFetchResult` (fetch) — no extra fields.

## Provider Capabilities

Capabilities are declared in `src/providers/types.ts`:

```typescript
export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  tavily:    { search: true,  fetch: true  },
  exa:       { search: true,  fetch: true  },
  gemini:    { search: true,  fetch: false },
  firecrawl: { search: true,  fetch: true  },
  jina:      { search: false, fetch: true  },
  brave:     { search: true,  fetch: false },
  searxng:   { search: true,  fetch: false },
};
```

All configured providers with `search: true` participate in the default search channel set unless the caller overrides `channels`.

## Default Fetch Priority

`DEFAULT_FETCH_PRIORITY = ['firecrawl', 'jina']` (`src/providers/types.ts:19`). When fetch `channels` are omitted, configured providers in this list are attempted first, followed by the remaining configured fetch providers.

## Registration

To add a new provider, update all four places:

1. `src/config/types.ts` — add to `ProviderId` union and `Config` interface.
2. `src/providers/types.ts` — add to `PROVIDER_CAPABILITIES`.
3. `src/providers/registry.ts` — add to `isConfigured()`, `getSearchProviders()` or `getFetchProviders()`.
4. `src/config/env.ts` — read the new env var(s) and add to `Config`.
