import type { ProviderId } from '../config/types.js';
import { ProviderError } from '../lib/errors.js';
import { normalizeUrl } from '../lib/url.js';
import type { RawFetchResult } from '../providers/fetch-types.js';
import { DEFAULT_FETCH_PRIORITY } from '../providers/types.js';
import type {
  BlockedPageDetector,
  BlockedPageSignal,
  ContentQualityScorer,
  FetchBestSelector,
  FetchCandidate,
  FetchCandidateBuilder,
  FetchDiagnostics,
  FetchQualityScore,
} from './fetch-diagnostics-types.js';

// ---------------------------------------------------------------------------
// BlockedPageDetector
// ---------------------------------------------------------------------------

/**
 * Provider error codes / tags that indicate the target page blocked the fetch.
 */
const BLOCKED_ERROR_CODES = new Set([
  'SOURCE_NOT_AVAILABLE',
  'ROBOTS_FILTER_FAILED',
  '401',
  '403',
  '429',
]);

/**
 * HTTP status codes that indicate blocking (as opposed to a transient network issue).
 */
const BLOCKED_HTTP_STATUSES = new Set([401, 403, 429]);

/**
 * Heuristic text patterns that indicate a CDN challenge / anti-bot / login wall.
 * Matched case-insensitively against the result title + content.
 */
const BLOCKED_TEXT_PATTERNS = [
  /just a moment/i, // Cloudflare "Just a moment..."
  /checking your browser/i, // Generic browser check
  /cf-browser-verification/i,
  /cloudflare/i,
  /access denied/i,
  /you have been blocked/i,
  /permission denied/i,
  /sign in to continue/i,
  /log in to continue/i,
  /login required/i,
  /please sign in/i,
  /please log in/i,
  /unauthorized access/i,
  /403 forbidden/i,
  /attention required/i, // Cloudflare "Attention Required"
  /ddos protection/i,
  /captcha/i,
  /verify you are human/i,
  /bot detection/i,
];

function isEmptyContent(content: string): boolean {
  return content.trim().length === 0;
}

/**
 * Detects whether a fetch result represents a blocked page.
 */
export function detectBlocked(
  result: RawFetchResult,
  error?: {
    code?: string;
    category?: string;
    httpStatus?: number;
    message?: string;
  },
): BlockedPageSignal {
  // 1. Provider error signals
  if (error) {
    const code = error.code ?? '';
    if (BLOCKED_ERROR_CODES.has(code)) {
      return {
        blocked: true,
        reason: `provider error code: ${code}${error.httpStatus ? ` (http ${error.httpStatus})` : ''}`,
      };
    }

    const status = error.httpStatus;
    if (status !== undefined && BLOCKED_HTTP_STATUSES.has(status)) {
      return {
        blocked: true,
        reason: `http status ${status}`,
      };
    }
  }

  // 2. Content / title heuristic text matching
  const haystack = `${result.title ?? ''}\n${result.content}`;

  for (const pattern of BLOCKED_TEXT_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        blocked: true,
        reason: `content heuristic: matched /${pattern.source}/`,
      };
    }
  }

  return { blocked: false };
}

// ---------------------------------------------------------------------------
// FetchCandidateBuilder
// ---------------------------------------------------------------------------

/**
 * Default implementation of `FetchCandidateBuilder`.
 */
export function buildFetchCandidate(
  provider: string,
  outcome: PromiseSettledResult<RawFetchResult>,
): FetchCandidate {
  let result: RawFetchResult | null = null;
  let diagnostics: FetchDiagnostics;

  if (outcome.status === 'fulfilled') {
    result = outcome.value;
    const emptyContent = isEmptyContent(result.content);
    const blockedSignal = detectBlocked(result);

    diagnostics = {
      success: !emptyContent && !blockedSignal.blocked,
      emptyContent,
      blocked: blockedSignal.blocked,
      blockReason: blockedSignal.reason,
    };
  } else {
    // rejected
    const reason = outcome.reason;
    let code = 'UNKNOWN';
    let category = 'UNKNOWN';
    let message = 'unknown error';
    let httpStatus: number | undefined;

    if (reason instanceof ProviderError) {
      code = reason.code;
      category = reason.category;
      message = reason.message;

      // Try to extract httpStatus from the code if it looks like a status code
      const parsed = Number.parseInt(code, 10);
      if (Number.isFinite(parsed) && parsed >= 100 && parsed < 600) {
        httpStatus = parsed;
      }
    } else if (reason instanceof Error) {
      message = reason.message;
    } else {
      message = String(reason);
    }

    // For rejected outcomes we don't have a RawFetchResult to feed into the detector.
    // However the ProviderError code/httpStatus may indicate a blocked page.
    const blockedSignal =
      httpStatus !== undefined
        ? detectBlocked(
            { url: '', content: '', format: 'text', fetchedAt: '' },
            { code, category, httpStatus, message },
          )
        : detectBlocked(
            { url: '', content: '', format: 'text', fetchedAt: '' },
            { code, category, message },
          );

    diagnostics = {
      success: false,
      emptyContent: true,
      blocked: blockedSignal.blocked,
      blockReason: blockedSignal.reason,
      providerErrorCode: code,
      providerErrorCategory: category,
      providerErrorMessage: message,
      httpStatus,
    };
  }

  return { provider, result, diagnostics };
}

// ---------------------------------------------------------------------------
// ContentQualityScorer
// ---------------------------------------------------------------------------

/**
 * Index lookup for provider priority. Lower index = higher priority.
 */
function getProviderPriority(provider: string, priorityList: ProviderId[]): number {
  const idx = priorityList.indexOf(provider as ProviderId);
  return idx >= 0 ? idx : priorityList.length;
}

/**
 * Default implementation of `ContentQualityScorer`.
 *
 * MVP scoring dimensions:
 *   - contentLength: characters of trimmed content (primary)
 *   - hasTitle: +1 if a non-empty title exists
 *   - urlMatch: +1 if result URL normalizes to the same as the input URL
 *   - providerPriority: tie-breaker (lower index in DEFAULT_FETCH_PRIORITY wins)
 *
 * The `score` field is a synthetic weighted number; `providerPriority` is kept
 * in the breakdown but used only as a tie-breaker in the selector, not added to
 * the score itself.
 */
export function scoreContentQuality(
  candidate: FetchCandidate,
  inputUrl?: string,
  priorityList: ProviderId[] = DEFAULT_FETCH_PRIORITY,
): FetchQualityScore {
  const result = candidate.result;
  if (!result) {
    return {
      score: -1,
      breakdown: {
        contentLength: 0,
        hasTitle: false,
        urlMatch: false,
        providerPriority: getProviderPriority(candidate.provider, priorityList),
      },
    };
  }

  const contentLength = result.content.trim().length;
  const hasTitle = result.title !== undefined && result.title.trim().length > 0;
  const urlMatch = inputUrl !== undefined && normalizeUrl(result.url) === normalizeUrl(inputUrl);
  const providerPriority = getProviderPriority(candidate.provider, priorityList);

  // Weighted score: content length dominates, title and url match are bonus.
  let score = contentLength;
  if (hasTitle) score += 100;
  if (urlMatch) score += 50;

  return {
    score,
    breakdown: { contentLength, hasTitle, urlMatch, providerPriority },
  };
}

// ---------------------------------------------------------------------------
// FetchBestSelector
// ---------------------------------------------------------------------------

/**
 * Default implementation of `FetchBestSelector`.
 *
 * 1. Filter candidates where `diagnostics.success === true`.
 * 2. Sort by `ContentQualityScorer.score` descending.
 * 3. Tie-break by `DEFAULT_FETCH_PRIORITY` order (lower index = higher priority).
 * 4. Return null if no valid candidates.
 */
export function selectBestCandidate(
  candidates: FetchCandidate[],
  inputUrl?: string,
  priorityList: ProviderId[] = DEFAULT_FETCH_PRIORITY,
): FetchCandidate | null {
  const valid = candidates.filter((c) => c.diagnostics.success);
  if (valid.length === 0) return null;

  // Score all valid candidates
  const scored = valid.map((c) => ({
    candidate: c,
    quality: scoreContentQuality(c, inputUrl, priorityList),
  }));

  // Sort by score descending; tie-break by provider priority ascending (lower = better)
  scored.sort((a, b) => {
    if (b.quality.score !== a.quality.score) {
      return b.quality.score - a.quality.score;
    }
    const aPriority = getProviderPriority(a.candidate.provider, priorityList);
    const bPriority = getProviderPriority(b.candidate.provider, priorityList);
    return aPriority - bPriority;
  });

  return scored[0]?.candidate ?? null;
}
