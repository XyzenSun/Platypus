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
  tavily:    { search: true,  fetch: true,  searchOptInOnly: false },
  exa:       { search: true,  fetch: true,  searchOptInOnly: false },
  gemini:    { search: true,  fetch: false, searchOptInOnly: false },
  firecrawl: { search: true,  fetch: true,  searchOptInOnly: true  },
  jina:      { search: false, fetch: true,  searchOptInOnly: false },
  brave:     { search: true,  fetch: false, searchOptInOnly: false },
  searxng:   { search: true,  fetch: false, searchOptInOnly: false },
};
```

`searchOptInOnly: true` means the provider is excluded from default search channels and only used when explicitly named in the `channels` parameter.

## Default Fetch Priority

`DEFAULT_FETCH_PRIORITY = ['firecrawl', 'jina']` (`src/providers/types.ts:20`). Providers in this list are placed first in `defaultFetchChannels`.

## Registration

To add a new provider, update all four places:

1. `src/config/types.ts` — add to `ProviderId` union and `Config` interface.
2. `src/providers/types.ts` — add to `PROVIDER_CAPABILITIES`.
3. `src/providers/registry.ts` — add to `isConfigured()`, `getSearchProviders()` or `getFetchProviders()`.
4. `src/config/env.ts` — read the new env var(s) and add to `Config`.
