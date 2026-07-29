export interface NormalizedFetchParams {
  urls: string[];
  channels?: string[];
  format: 'markdown' | 'text';
  timeoutMs: number;
}

export interface RawFetchResult {
  url: string;
  title?: string;
  content: string;
  format: 'markdown' | 'text';
  fetchedAt: string;
}

export interface FetchProvider {
  id: string;
  fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult>;
}

export interface FetchWarning {
  provider: string;
  url: string;
  code: string;
  message: string;
}

/**
 * The best fetch result selected by the aggregator, tagged with the source provider.
 */
export interface FetchBestResult extends RawFetchResult {
  /** The provider that produced this best result. */
  provider: string;
  /** Index signature for MCP structuredContent compatibility. */
  [x: string]: unknown;
}

/**
 * Response from `aggregateFetchBest`: either a best result or null when all
 * providers failed / had no valid content, plus per-provider failure summaries
 * for error reporting.
 */
export interface FetchBestResponse {
  /** The highest-quality valid result, or null when no provider succeeded. */
  best: FetchBestResult | null;
  /** Per-provider error summaries (not exposed to the caller; used for error messages). */
  failures: { provider: string; code: string; message: string }[];
}
