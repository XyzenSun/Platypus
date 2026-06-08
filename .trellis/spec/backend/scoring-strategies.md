# Scoring Strategies

## ScoringStrategy Interface

Defined in `src/aggregator/scoring-types.ts`:

```typescript
type ProviderRanked = Map<string, RawProviderResult[]>;  // key = provider id

interface ScoringStrategy {
  readonly id: string;
  merge(input: ProviderRanked): SearchResult[];
}
```

`merge` receives per-provider ordered result lists and must return a deduplicated, score-sorted `SearchResult[]` with `score`, `rank`, and `sources` populated.

Implementations are responsible for:
- URL canonicalization via `normalizeUrl` from `src/lib/url.ts`.
- Deduplication (same canonical URL from different providers = one result).
- Content merging (longest non-empty field wins for `title`, `content`).

## RrfScoringStrategy (default)

`src/aggregator/strategies/rrf.ts` — implements Reciprocal Rank Fusion (Cormack et al., SIGIR 2009):

```
score(d) = Σ_provider  1 / (k + rank_p(d))     k = 60
```

- k=60 is the paper-recommended default, also used by Elasticsearch, Azure AI Search, and MongoDB `$rankFusion`.
- `sources` field lists every provider that returned the canonical URL.
- `publishedDate`: first non-empty wins.

## Scenario: Search result identity when URL is missing

### 1. Scope / Trigger
- Trigger: search result response contract changed at the aggregator boundary because `SearchResult.id` must remain stable even when a provider returns an empty `url`.
- Applies to: `RrfScoringStrategy.merge()` and every caller consuming aggregated `SearchResult[]`.
- Does not apply to: fetch providers or Gemini's sentinel URL flow.

### 2. Signatures
- Aggregator input:

```typescript
type ProviderRanked = Map<string, RawProviderResult[]>;
```

- Search provider payload:

```typescript
interface RawProviderResult {
  url: string;
  title: string;
  content?: string;
  publishedDate?: string;
}
```

- Aggregator output:

```typescript
interface SearchResult {
  id: string;
  title: string;
  url: string;
  content?: string;
  score: number;
  rank: number;
  sources: string[];
  publishedDate?: string;
}
```

### 3. Contracts
- Request-side contract:
  - Search adapters may return `url: ''` only when `hasContent=true` and the upstream returned useful content without a URL.
  - Search adapters must continue filtering empty-URL records when `hasContent=false`.
- Response-side contract:
  - If `url` is non-empty, `SearchResult.id` must equal `normalizeUrl(url)`.
  - If `url` is empty, `SearchResult.id` must equal `missing-url-<provider>-<hash>`.
  - `<hash>` must be generated with Node built-in `crypto.createHash('sha256')` over `provider + '\0' + titleOrNull + '\0' + contentOrNull`.
  - Missing `title` and missing `content` must participate as the literal semantic value `null` when building the hash input.
  - The RRF internal dedup key and final `SearchResult.id` must be the same value.
- Environment contract:
  - No new env keys.
  - No new dependencies.

### 4. Validation & Error Matrix
| Condition | Behavior |
|---|---|
| `url` is non-empty | Use canonical URL as dedup key and `SearchResult.id` |
| `url` is empty and `hasContent=true` | Keep the result, derive fallback identity, dedup on that identity |
| `url` is empty and `hasContent=false` | Adapter filters the record before aggregation |
| `title` missing/empty | Treat as `null` in fallback hash input |
| `content` missing/empty | Treat as `null` in fallback hash input |
| Same provider + same missing-url hash input | Results may merge as an accepted degenerate case |
| Different content/title under same provider with empty URL | Must not merge |

### 5. Good / Base / Bad Cases
- Good:
  - Exa returns two empty-URL results with different `content`; RRF outputs two results with different `id` values.
- Base:
  - Tavily returns one empty-URL result with `title=''` and `content` present; RRF returns `id=missing-url-tavily-<hash>` and preserves `url=''`.
- Bad:
  - RRF uses `normalizeUrl(r.url)` directly for every record; all empty-URL results collapse to `''` and merge incorrectly.

### 6. Tests Required
- Unit: `tests/unit/rrf.test.ts`
  - assert canonical URL dedup still works
  - assert missing-URL fallback id format is used
  - assert dedup key equals final `SearchResult.id`
  - assert different empty-URL results do not merge
  - assert missing `title` / `content` are treated as `null`
  - assert accepted degenerate merge behavior for same provider + all-missing-equivalent payloads
- Unit: `tests/unit/search-adapters.test.ts`
  - assert Exa/Tavily filter empty URLs when `hasContent=false`
  - assert Exa/Tavily keep empty URLs when `hasContent=true`
  - assert adapters do not generate identity fields themselves

### 7. Wrong vs Correct
#### Wrong
```typescript
const canonical = normalizeUrl(r.url);
const existing = merged.get(canonical);
...
id: canonical,
```

#### Correct
```typescript
const identity = r.url
  ? normalizeUrl(r.url)
  : `missing-url-${provider}-${createHash('sha256')
      .update(provider)
      .update('\0')
      .update(r.title || 'null')
      .update('\0')
      .update(r.content || 'null')
      .digest('hex')}`;

const existing = merged.get(identity);
...
id: identity,
```

## GeminiBoostScoringStrategy (active default)

`src/aggregator/strategies/gemini-boost.ts` — wraps `RrfScoringStrategy` and applies a post-merge score adjustment to Gemini results. This is the actual default passed to `aggregateSearch`.

Reference: `src/aggregator/search.ts:11` — `const defaultScoring = new GeminiBoostScoringStrategy()`.

## Scenario: Search post-processing weights and domain blacklist

### 1. Scope / Trigger
- Trigger: aggregator response ranking now depends on startup-loaded env wiring and a remote blacklist contract, so code-spec depth is required for scoring + config boundaries.
- Applies to: `src/aggregator/search.ts`, `src/aggregator/strategies/post-process.ts`, `src/config/env.ts`, `src/config/domain-blacklist.ts`, and callers of the search tool.
- Does not apply to: provider adapter request mapping or fetch providers.

### 2. Signatures
- Scoring wrapper factory:

```typescript
function createSearchScoring(config: Config): ScoringStrategy;
```

- Config contract:

```typescript
interface SearchPostProcessConfig {
  providerWeights: Partial<Record<ProviderId, number>>;
  domainBlacklistUrl: string;
  domainBlacklist: ReadonlySet<string>;
}
```

- Domain blacklist helpers:

```typescript
function parseDomainBlacklist(text: string): Set<string>;
function isDomainBlacklisted(hostname: string, blacklist: ReadonlySet<string>): boolean;
async function loadDomainBlacklist(url?: string): Promise<Set<string>>;
```

### 3. Contracts
- Request/aggregation contract:
  - Base strategy still produces merged `SearchResult[]` first.
  - Post-processing then applies `score = score * providerWeight` and re-sorts/re-ranks results.
  - Domain blacklist filtering happens after score adjustment and before final rank assignment.
- Environment contract:
  - `SEARCH_PROVIDER_WEIGHTS` is optional.
  - Format: comma-separated `provider:value` pairs, e.g. `exa:1.5,gemini:0.7`.
  - Supported provider keys: `tavily`, `exa`, `brave`, `jina`, `searxng`, `firecrawl`, `gemini`.
  - Missing providers default to weight `1`.
  - Invalid provider keys or non-finite numeric values are ignored.
  - `DOMAIN_BLACKLIST_URL` is optional and overrides the built-in default raw URL.
- Startup-loading contract:
  - `loadConfig()` must load the blacklist once during process startup.
  - No TTL refresh.
  - No local file fallback.
  - Blacklist load failures surface from startup config loading rather than being silently ignored.
- Blacklist file contract:
  - Source file is `src/config/domain-blacklist.txt`.
  - Format is plain text: one domain per line.
  - Empty lines and `#` comment lines are ignored.
  - Matching is parent-domain based: `example.com` blocks `example.com`, `www.example.com`, and deeper subdomains.

### 4. Validation & Error Matrix
| Condition | Behavior |
|---|---|
| `SEARCH_PROVIDER_WEIGHTS` unset | Use empty map, all providers behave as weight `1` |
| Pair has unknown provider key | Ignore that pair |
| Pair has non-finite value | Ignore that pair |
| `DOMAIN_BLACKLIST_URL` unset | Use built-in default raw URL |
| Remote blacklist fetch returns non-OK | Throw startup config error and fail startup |
| Blacklist contains `example.com` and result host is `a.b.example.com` | Result is filtered out |
| Result URL is malformed | Do not blacklist-filter that record |
| Blacklist is empty | Filtering step becomes a no-op |

### 5. Good / Base / Bad Cases
- Good:
  - `SEARCH_PROVIDER_WEIGHTS="exa:1.5,gemini:0.5"` boosts Exa-backed results, demotes Gemini-only results, then recomputes rank.
- Base:
  - Blacklist file contains `example.com`; result `https://www.example.com/a` is removed from final output.
- Bad:
  - Provider adapters inspect blacklist env vars or apply filtering before returning `RawProviderResult[]`.

### 6. Tests Required
- Unit: `tests/unit/post-process-scoring.test.ts`
  - assert weighted scores are multiplied correctly
  - assert filtered blacklist results are removed
  - assert ranks are recomputed after weighting/filtering
  - assert multi-source results use the highest configured provider weight
- Unit: `tests/unit/domain-blacklist.test.ts`
  - assert txt parsing ignores comments/empty lines
  - assert parent-domain matching works for nested subdomains
  - assert remote load parses fetched text into a `Set`
- Unit: `tests/unit/env.test.ts`
  - assert default blacklist URL is used when env override is absent
  - assert `DOMAIN_BLACKLIST_URL` override is respected
  - assert provider weight parsing ignores invalid/unknown entries

### 7. Wrong vs Correct
#### Wrong
```typescript
class ExaSearchProvider {
  async search(params) {
    const blocked = process.env.DOMAIN_BLACKLIST_URL;
    // provider-side filtering leaks aggregation policy downward
  }
}
```

#### Correct
```typescript
const scoring = createSearchScoring(config);
const response = await aggregateSearch(request, providers, scoring);
// aggregation completes first, then post-processing applies weights and blacklist rules
```


## URL Normalization

`normalizeUrl` (`src/lib/url.ts`) canonicalizes for dedup:
- Forces `https`.
- Strips `www.`, trailing slash, fragment (`#`).
- Removes tracking params (`utm_*`, `fbclid`, `gclid`, etc.).

## Scenario: Request-scoped search result filters (`minScore` / `maxRank`)

### 1. Scope / Trigger
- Trigger: the `search` MCP tool request contract now exposes two optional result-filter fields that affect the final aggregated response shape.
- Applies to: `src/tools/schemas.ts`, `src/tools/search.ts`, `src/providers/search-types.ts`, `src/aggregator/search.ts`, `src/aggregator/scoring-types.ts`, `src/aggregator/strategies/post-process.ts`, and callers of the `search` tool.
- Does not apply to: provider adapter request compilation or upstream provider APIs.

### 2. Signatures
- MCP tool input schema:

```typescript
const SearchInputSchema = z.object({
  ...
  minScore: z.number().finite().optional(),
  maxRank: z.number().int().min(1).optional(),
});
```

- Unified request contract:

```typescript
interface SearchRequest {
  ...
  minScore?: number;
  maxRank?: number;
}
```

- Scoring wrapper factory:

```typescript
function createSearchScoring(
  config: Config,
  request?: Pick<SearchRequest, 'minScore' | 'maxRank'>,
): ScoringStrategy;
```

- Post-process options:

```typescript
interface ScoringPostProcessOptions {
  providerWeights?: Partial<Record<ProviderId, number>>;
  domainBlacklist?: ReadonlySet<string>;
  minScore?: number;
  maxRank?: number;
}
```

### 3. Contracts
- Request contract:
  - `minScore` is optional and means “keep only results with `score >= minScore`”.
  - `maxRank` is optional and means “keep only results with `rank <= maxRank`”.
  - Omitting both fields must preserve existing search behavior exactly.
- Aggregation contract:
  - Provider adapters do not receive `minScore` or `maxRank`; they stay in the unified request / aggregation layer only.
  - Final result processing order is:
    1. merge base scoring strategy output
    2. apply provider weights
    3. apply domain blacklist filtering
    4. re-sort / re-rank by final score
    5. apply `minScore` / `maxRank` filtering against the final `score` / `rank`
  - Filtering does not recompute rank after removal; `maxRank` is evaluated against the already re-ranked final list.
- Response contract:
  - `results` may shrink after filtering.
  - `warnings` and `error` behavior remain unchanged.
- Environment contract:
  - No new env keys are introduced for these filters.

### 4. Validation & Error Matrix
| Condition | Behavior |
|---|---|
| `minScore` omitted | Do not filter by score |
| `maxRank` omitted | Do not filter by rank |
| Both omitted | Preserve previous post-process behavior |
| `minScore` provided and result `score < minScore` | Remove the result |
| `maxRank` provided and result `rank > maxRank` | Remove the result |
| `maxRank < 1` | Reject at Zod schema validation |
| `minScore` non-finite | Reject at Zod schema validation |
| Provider returns low scores (e.g. typical RRF ~0.01–0.03) and `minScore` is too high | Return empty `results` array, not an error |

### 5. Good / Base / Bad Cases
- Good:
  - Request sets `minScore=0.01` and `maxRank=10`; final response returns only the top 10 final-ranked results whose score is at least `0.01`.
- Base:
  - Request omits both fields; response matches the previous weighted + blacklist-filtered + re-ranked behavior.
- Bad:
  - Provider adapter inspects `minScore` and truncates upstream results before aggregation.

### 6. Tests Required
- Unit: `tests/unit/post-process-scoring.test.ts`
  - assert default behavior is unchanged when no filters are configured
  - assert `minScore` runs after weighting, blacklist filtering, and re-ranking
  - assert `maxRank` uses the final re-ranked list
  - assert `minScore` + `maxRank` compose on final results
- Real/E2E verification:
  - call the `search` MCP tool with `channels=['exa', 'tavily']`
  - verify `maxRank=10` + `minScore=0.01` returns bounded results
  - verify a high threshold like `minScore=0.2` can legitimately return `[]` without error
- Type / contract checks:
  - assert the request path from tool schema → `SearchRequest` → `createSearchScoring()` preserves the optional fields

### 7. Wrong vs Correct
#### Wrong
```typescript
function buildProviderParams(request: SearchRequest): ProviderSearchParams {
  return {
    ...,
    minScore: request.minScore,
    maxRank: request.maxRank,
  };
}
```

#### Correct
```typescript
const request: SearchRequest = {
  ...,
  minScore: params.minScore,
  maxRank: params.maxRank,
};

const scoring = createSearchScoring(config, request);
const response = await aggregateSearch(request, providers, scoring);
```
