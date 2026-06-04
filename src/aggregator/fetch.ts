import { ProviderError } from '../lib/errors.js';
import type {
  FetchProvider,
  FetchResponse,
  FetchWarning,
  NormalizedFetchParams,
  RawFetchResult,
} from '../providers/fetch-types.js';

/**
 * Concurrently fetch every URL across every selected provider via Promise.allSettled.
 * Returns a byProvider view: results[url][provider] = RawFetchResult.
 * Single-provider failures become warnings; the rest still return.
 */
export async function aggregateFetch(
  params: NormalizedFetchParams,
  providers: FetchProvider[],
): Promise<FetchResponse> {
  if (providers.length === 0) {
    throw new Error('No fetch channels available for the given configuration.');
  }

  // Build (url, provider) tasks for parallel execution.
  const tasks: { url: string; provider: FetchProvider }[] = [];
  for (const url of params.urls) {
    for (const provider of providers) {
      tasks.push({ url, provider });
    }
  }

  const settled = await Promise.allSettled(
    tasks.map((t) =>
      t.provider
        .fetch(t.url, params)
        .then((result) => ({ url: t.url, provider: t.provider.id, result })),
    ),
  );

  // Pre-seed empty per-url buckets so callers can see "URL was attempted but all failed".
  const results: FetchResponse['results'] = {};
  for (const url of params.urls) results[url] = {};

  const warnings: FetchWarning[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const task = tasks[i];
    if (!outcome || !task) continue;

    if (outcome.status === 'fulfilled') {
      const { url, provider, result } = outcome.value;
      const bucket = results[url];
      if (bucket) bucket[provider] = result;
      continue;
    }

    const err = outcome.reason;
    const taskUrl = task.url;
    const taskProvider = task.provider.id;
    if (err instanceof ProviderError) {
      warnings.push({
        provider: err.provider,
        url: taskUrl,
        code: err.code,
        message: err.message,
      });
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push({
        provider: taskProvider,
        url: taskUrl,
        code: 'UNKNOWN',
        message: msg,
      });
    }
  }

  return { results, warnings };
}

// Re-export for tools/fetch.ts test convenience.
export type { RawFetchResult };
