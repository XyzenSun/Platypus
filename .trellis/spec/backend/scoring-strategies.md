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

## GeminiBoostScoringStrategy (active default)

`src/aggregator/strategies/gemini-boost.ts` — wraps `RrfScoringStrategy` and applies a post-merge score adjustment to Gemini results. This is the actual default passed to `aggregateSearch`.

Reference: `src/aggregator/search.ts:11` — `const defaultScoring = new GeminiBoostScoringStrategy()`.

## Adding a New Strategy

1. Create `src/aggregator/strategies/<name>.ts` implementing `ScoringStrategy`.
2. Delegate URL canonicalization to `normalizeUrl` — do not re-implement it.
3. Pass the strategy instance as the third argument to `aggregateSearch()`.
4. Add unit tests in `tests/unit/`.

## URL Normalization

`normalizeUrl` (`src/lib/url.ts`) canonicalizes for dedup:
- Forces `https`.
- Strips `www.`, trailing slash, fragment (`#`).
- Removes tracking params (`utm_*`, `fbclid`, `gclid`, etc.).
