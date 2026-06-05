# Error Handling

## ProviderError

All provider failures must be wrapped in `ProviderError` (`src/lib/errors.ts`):

```typescript
throw new ProviderError('provider-id', category, String(res.status), text || res.statusText);
```

`ErrorCategory` values and their behaviour:

| Category | HTTP statuses | Behaviour |
|----------|---------------|-----------|
| `NETWORK` | 429, 408, 5xx, AbortError, ECONNRESET, etc. | Retried by `withRetry`; becomes `SearchWarning` if all retries exhausted |
| `QUOTA` | 401, 402, 403, 432, 433 | Never retried; becomes `SearchWarning` |
| `USER_ERROR` | Other 4xx | Re-thrown immediately — aborts the whole request |

## HTTP Error Pattern

Every adapter must use `classifyHttpStatus` to classify the response:

```typescript
if (!res.ok) {
  const category = classifyHttpStatus(res.status);
  const text = await res.text().catch(() => '');
  throw new ProviderError('tavily', category, String(res.status), text || res.statusText);
}
```

Reference: `src/providers/tavily.ts:64-73`.

## withRetry

Wrap all external HTTP calls in `withRetry`. Default delays: `[1000, 2000, 4000]` ms. Only `NETWORK` errors are retried.

```typescript
return withRetry(async () => {
  const signal = AbortSignal.timeout(params.timeoutMs);
  const res = await fetch(url, { ..., signal });
  if (!res.ok) { throw new ProviderError(...) }
  return parse(await res.json());
});
```

Reference: `src/lib/retry.ts`, `src/providers/tavily.ts:52`.

## Aggregator Error Handling

`aggregateSearch` uses `Promise.allSettled` — per-provider failures become warnings, not exceptions. The only case that throws is `USER_ERROR`. When all providers fail: `{ results: [], warnings, error: 'ALL_PROVIDERS_FAILED' }`.

Reference: `src/aggregator/search.ts:22-51`.

## Anti-Patterns

- Do not use a generic `Error` for provider failures — the aggregator cannot classify it.
- Do not swallow exceptions inside adapters.
- Do not retry `QUOTA` or `USER_ERROR` — only `NETWORK` is safe to retry.
