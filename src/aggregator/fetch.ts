import type {
  FetchBestResponse,
  FetchBestResult,
  FetchProvider,
  NormalizedFetchParams,
  RawFetchResult,
} from '../providers/fetch-types.js';
import type { FetchCandidate } from './fetch-diagnostics-types.js';
import { buildFetchCandidate, selectBestCandidate } from './fetch-diagnostics.js';

/**
 * Concurrently fetch a single URL across all selected providers via Promise.allSettled,
 * then select the highest-quality valid result using the diagnostic model.
 *
 * Returns `{ best, failures }`:
 *   - `best` is the highest-quality `FetchBestResult` or null when no provider succeeded.
 *   - `failures` is a per-provider error summary list (not exposed to callers; used
 *     internally by the tool layer to compose an error message).
 */
export async function aggregateFetchBest(
  url: string,
  params: NormalizedFetchParams,
  providers: FetchProvider[],
): Promise<FetchBestResponse> {
  if (providers.length === 0) {
    throw new Error('No fetch channels available for the given configuration.');
  }

  // Fire all provider calls in parallel.
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.fetch(url, params)),
  );

  // Convert each outcome into a FetchCandidate via the diagnostic model.
  const candidates: FetchCandidate[] = providers.map((provider, i) => {
    const outcome = settled[i];
    if (!outcome) {
      // Defensive fallback; should never happen with Promise.allSettled.
      return buildFetchCandidate(provider.id, {
        status: 'rejected',
        reason: new Error('missing outcome'),
      });
    }
    return buildFetchCandidate(provider.id, outcome);
  });

  // Select the best valid candidate.
  const best = selectBestCandidate(candidates, url);

  // Build per-provider failure summaries for error reporting.
  const failures: { provider: string; code: string; message: string }[] = [];
  for (const candidate of candidates) {
    if (!candidate.diagnostics.success) {
      const code = candidate.diagnostics.providerErrorCode ?? 'NO_CONTENT';
      const message =
        candidate.diagnostics.providerErrorMessage ??
        candidate.diagnostics.blockReason ??
        (candidate.diagnostics.emptyContent ? 'empty content' : 'unknown failure');
      failures.push({ provider: candidate.provider, code, message });
    }
  }

  if (best === null || best.result === null) {
    return { best: null, failures };
  }

  const bestResult: FetchBestResult = {
    ...best.result,
    provider: best.provider,
  };

  return { best: bestResult, failures };
}

// Re-export for test convenience.
export type { RawFetchResult };
