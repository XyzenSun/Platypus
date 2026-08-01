# Provider Conventions

## Interfaces

Search providers implement `SearchProvider` (`src/providers/search-types.ts`):

```typescript
interface SearchProvider {
  id: string;
  search(params: NormalizedSearchParams): Promise<RawProviderResult[]>;
}
```

> **Note**: Platypus formerly暴露了一个 `fetch` 工具与 `FetchProvider` 接口，已在 0.0.x 阶段彻底废弃。当前对外 MCP 工具只剩 `list` 与 `search`。新增 provider 只考虑 search 能力，不要再设计 fetch adapter。

## Adapter Pattern

Each adapter is a class that takes API credentials in the constructor and implements the `SearchProvider` interface. See `src/providers/tavily.ts` as the canonical search adapter example.

Key rules for every adapter:

- Store the API key as a private `readonly` field.
- Wrap the HTTP call in `withRetry`.
- Use `AbortSignal.timeout(params.timeoutMs)` for every fetch call.
- On non-OK response: call `classifyHttpStatus(res.status)` and throw `ProviderError`.
- Return `RawProviderResult[]` — no extra fields.

### Convention: Adapter vs aggregator identity responsibilities

**What**: Search adapters only map upstream payloads into `RawProviderResult`. They do not generate dedup keys, fallback IDs, or final `SearchResult.id` values.

**Why**: Identity semantics must stay centralized in the aggregator so all providers participate in the same dedup contract. If adapters generate identity independently, dedup behavior drifts and output `id` semantics split across channels.

**Example**:

```typescript
// Adapter: keep upstream mapping only
return data.results
  .filter((r) => params.hasContent || Boolean(r.url))
  .map((r) => ({
    url: r.url,
    title: r.title,
    content: params.hasContent ? (r.text ?? undefined) : undefined,
  }));
```

```typescript
// Aggregator: decide identity semantics once for every provider
const identity = result.url
  ? normalizeUrl(result.url)
  : `missing-url-${provider}-${hash}`;
```

**Related**: `.trellis/spec/backend/scoring-strategies.md`.

## Provider Set

All currently supported providers are search-only:

| Provider id | Env key driving configuration | Notes |
|-------------|-------------------------------|-------|
| `tavily`    | `TAVILY_API_KEY`              | Optional `TAVILY_BASE_URL` |
| `exa`       | `EXA_API_KEY`                 | Optional `EXA_BASE_URL` |
| `brave`     | `BRAVE_API_KEY`               | Optional `BRAVE_BASE_URL` |
| `jina`      | `JINA_API_KEY`                | Optional `JINA_BASE_URL` |
| `searxng`   | `SEARXNG_BASE_URL`            | Self-hosted; no API key |
| `firecrawl` | `FIRECRAWL_API_KEY`           | Optional `FIRECRAWL_BASE_URL` |
| `gemini`    | `GEMINI_API_KEY`              | Optional `GEMINI_BASE_URL` + `GEMINI_MODEL` |
| `ollama`    | `OLLAMA_API_KEY`              | Optional `OLLAMA_BASE_URL` |

All configured providers participate in the default search channel set unless the caller overrides `channels`.

## Registration

To add a new search provider, update four places:

1. `src/config/types.ts` — add to `ProviderId` union and `Config` interface.
2. `src/providers/registry.ts` — add to `ALL_PROVIDERS`, `isConfigured()`, and `getSearchProviders()` instantiation.
3. `src/config/env.ts` — read the new env var(s) and add to `Config`.
4. `tests/unit/registry.test.ts` — cover `isConfigured` and `buildRegistry` for the new provider.

> **Deprecated**: The previous `PROVIDER_CAPABILITIES` / `DEFAULT_FETCH_PRIORITY` constants and `getFetchProviders()` function were removed along with the fetch tool. Capability tracking was dropped because every retained provider is search-only — the `search` boolean became uniformly `true` and the `fetch` boolean became uniformly `false`. If a future provider introduces a non-search capability, reintroduce a capability map at that point (don't re-add the legacy fetch-flavored shape — design it fresh for the new capability).

## list Tool Output Schema

### Decision: Flat `providers` list (ADR-lite)

**Context**: When the fetch tool was removed, `list`'s output had to drop the `fetch` field. The question was whether to keep a `search` field (preserving one capability axis) or collapse to a flat provider list.

**Options Considered**:
1. `{ providers: ProviderId[] }` — flat list, no capability dimension.
2. `{ search: ProviderId[] }` — keep the surviving capability as a named field.
3. `{ providers: [{ id, capabilities: ['search'] }] }` — explicit capability metadata per provider.

**Decision**: Option 1 — flat `{ providers: ProviderId[] }`.

**Why**:
- Every retained provider is search-only, so a capability field would be uniformly `'search'` — zero information, pure noise.
- The tool's stated purpose is "list configured providers", not "describe their capabilities". Capability exposure belongs in tooling metadata (e.g. `buildCapabilityNote()`), not in the listing endpoint.
- If a non-search capability is reintroduced later, switching to option 3 then is a cleaner break than migrating away from a half-meaningful `search` field now.

**Contract**:

```typescript
interface ListResult {
  [key: string]: unknown;
  providers: ProviderId[];
}

function buildRegistry(config: Config): ListResult {
  // ALL_PROVIDERS.filter(p => isConfigured(p, config))
  return { providers: configured };
}
```

> **Gotcha — `[key: string]: unknown` index signature is mandatory**. The MCP SDK's `registerTool` type constraints reject `structuredContent` whose type lacks an index signature. Removing the index signature (it looks like a leftover from the old `{ search, fetch }` shape) breaks typecheck. Keep the index signature even though `providers` is the only declared field.

**Extensibility**: If a future provider adds a non-search capability, reintroduce a capability map (option 3) and update `buildRegistry` to filter by the requested capability rather than by configuration alone. Do not re-add the legacy `PROVIDER_CAPABILITIES` shape — design the new capability map around the actual new capability.
