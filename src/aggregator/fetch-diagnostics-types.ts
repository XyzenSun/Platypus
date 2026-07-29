import type { RawFetchResult } from '../providers/fetch-types.js';

/**
 * Unified diagnostics for a single fetch attempt by a single provider.
 *
 * `success` = no thrown error AND `result` is non-null AND content is non-empty.
 */
export interface FetchDiagnostics {
  /** Whether this candidate represents a valid successful fetch. */
  success: boolean;
  /** Content is empty or whitespace-only. */
  emptyContent: boolean;
  /** Whether the result is judged as a blocked page (401/403/CDN/anti-bot/login). */
  blocked: boolean;
  /** Human-readable reason for the blocked flag, if applicable. */
  blockReason?: string;
  /** Target-page HTTP status code, if available from the provider response. */
  httpStatus?: number;
  /** ProviderError.code, if the provider threw a ProviderError. */
  providerErrorCode?: string;
  /** ProviderError.category, if the provider threw a ProviderError. */
  providerErrorCategory?: string;
  /** ProviderError.message, if the provider threw a ProviderError. */
  providerErrorMessage?: string;
  /** Any other supplementary notes. */
  notes?: string;
}

/**
 * A single provider's fetch outcome for a single URL, plus diagnostics.
 */
export interface FetchCandidate {
  /** Source provider id. */
  provider: string;
  /** Normalized fetch result, or null when the provider failed / returned nothing. */
  result: RawFetchResult | null;
  /** Unified diagnostics computed by the builder. */
  diagnostics: FetchDiagnostics;
}

/**
 * Signal output from a BlockedPageDetector.
 */
export interface BlockedPageSignal {
  blocked: boolean;
  reason?: string;
}

/**
 * Score output from a ContentQualityScorer.
 */
export interface FetchQualityScore {
  /** Overall quality score (higher is better). */
  score: number;
  /** Optional breakdown of the score components. */
  breakdown?: {
    contentLength: number;
    hasTitle: boolean;
    urlMatch: boolean;
    providerPriority: number;
  };
}

// ---------------------------------------------------------------------------
// Interfaces (pure function contracts)
// ---------------------------------------------------------------------------

/**
 * Maps a `Promise.allSettled` outcome into a `FetchCandidate`.
 */
export interface FetchCandidateBuilder {
  build(provider: string, outcome: PromiseSettledResult<RawFetchResult>): FetchCandidate;
}

/**
 * Detects whether a fetch result represents a blocked page.
 */
export interface BlockedPageDetector {
  detect(
    result: RawFetchResult,
    error?: {
      code?: string;
      category?: string;
      httpStatus?: number;
      message?: string;
    },
  ): BlockedPageSignal;
}

/**
 * Scores the quality of a valid fetch candidate.
 */
export interface ContentQualityScorer {
  score(candidate: FetchCandidate): FetchQualityScore;
}

/**
 * Selects the best valid candidate from a list.
 */
export interface FetchBestSelector {
  select(candidates: FetchCandidate[]): FetchCandidate | null;
}
