import { describe, expect, it } from 'vitest';
import type { FetchCandidate } from '../../src/aggregator/fetch-diagnostics-types.js';
import {
  buildFetchCandidate,
  detectBlocked,
  scoreContentQuality,
  selectBestCandidate,
} from '../../src/aggregator/fetch-diagnostics.js';
import { ProviderError } from '../../src/lib/errors.js';
import type { RawFetchResult } from '../../src/providers/fetch-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFulfilledResult(overrides: Partial<RawFetchResult> = {}): RawFetchResult {
  return {
    url: 'https://example.com/page',
    title: 'Example Page',
    content: 'This is the main content of the page. It has enough text to be considered non-empty.',
    format: 'markdown',
    fetchedAt: '2026-07-29T00:00:00.000Z',
    ...overrides,
  };
}

function fulfilled(value: RawFetchResult): PromiseSettledResult<RawFetchResult> {
  return { status: 'fulfilled', value };
}

function rejected(reason: unknown): PromiseSettledResult<RawFetchResult> {
  return { status: 'rejected', reason };
}

// ---------------------------------------------------------------------------
// FetchCandidateBuilder
// ---------------------------------------------------------------------------

describe('buildFetchCandidate', () => {
  it('maps a fulfilled RawFetchResult with content into a success candidate', () => {
    const result = makeFulfilledResult();
    const candidate = buildFetchCandidate('firecrawl', fulfilled(result));

    expect(candidate.provider).toBe('firecrawl');
    expect(candidate.result).toEqual(result);
    expect(candidate.diagnostics.success).toBe(true);
    expect(candidate.diagnostics.emptyContent).toBe(false);
    expect(candidate.diagnostics.blocked).toBe(false);
    expect(candidate.diagnostics.providerErrorCode).toBeUndefined();
  });

  it('maps a fulfilled RawFetchResult with empty content into a non-success candidate', () => {
    const result = makeFulfilledResult({ content: '   ' });
    const candidate = buildFetchCandidate('jina', fulfilled(result));

    expect(candidate.diagnostics.success).toBe(false);
    expect(candidate.diagnostics.emptyContent).toBe(true);
    expect(candidate.diagnostics.blocked).toBe(false);
  });

  it('maps a rejected ProviderError into a failed candidate with error fields', () => {
    const error = new ProviderError('exa', 'QUOTA', 'SOURCE_NOT_AVAILABLE', 'access forbidden');
    const candidate = buildFetchCandidate('exa', rejected(error));

    expect(candidate.provider).toBe('exa');
    expect(candidate.result).toBeNull();
    expect(candidate.diagnostics.success).toBe(false);
    expect(candidate.diagnostics.providerErrorCode).toBe('SOURCE_NOT_AVAILABLE');
    expect(candidate.diagnostics.providerErrorCategory).toBe('QUOTA');
    expect(candidate.diagnostics.providerErrorMessage).toBe('access forbidden');
  });

  it('extracts httpStatus from a ProviderError whose code is a 3-digit status', () => {
    const error = new ProviderError('tavily', 'QUOTA', '403', 'forbidden');
    const candidate = buildFetchCandidate('tavily', rejected(error));

    expect(candidate.diagnostics.httpStatus).toBe(403);
    expect(candidate.diagnostics.blocked).toBe(true);
  });

  it('maps a rejected generic Error into a failed candidate with code UNKNOWN', () => {
    const candidate = buildFetchCandidate('jina', rejected(new Error('something went wrong')));

    expect(candidate.diagnostics.success).toBe(false);
    expect(candidate.diagnostics.providerErrorCode).toBe('UNKNOWN');
    expect(candidate.diagnostics.providerErrorMessage).toBe('something went wrong');
  });

  it('maps a rejected non-Error value into a failed candidate', () => {
    const candidate = buildFetchCandidate('jina', rejected('string error'));

    expect(candidate.diagnostics.success).toBe(false);
    expect(candidate.diagnostics.providerErrorCode).toBe('UNKNOWN');
    expect(candidate.diagnostics.providerErrorMessage).toBe('string error');
  });
});

// ---------------------------------------------------------------------------
// BlockedPageDetector (detectBlocked)
// ---------------------------------------------------------------------------

describe('detectBlocked', () => {
  it('returns blocked=true for Exa SOURCE_NOT_AVAILABLE error code', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { code: 'SOURCE_NOT_AVAILABLE' });

    expect(signal.blocked).toBe(true);
    expect(signal.reason).toContain('SOURCE_NOT_AVAILABLE');
  });

  it('returns blocked=true for HTTP 403 status', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { code: '403', httpStatus: 403 });

    expect(signal.blocked).toBe(true);
    expect(signal.reason).toContain('403');
  });

  it('returns blocked=true for HTTP 401 status', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { httpStatus: 401 });

    expect(signal.blocked).toBe(true);
  });

  it('returns blocked=true for HTTP 429 status', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { httpStatus: 429 });

    expect(signal.blocked).toBe(true);
  });

  it('returns blocked=true for ROBOTS_FILTER_FAILED error code', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { code: 'ROBOTS_FILTER_FAILED' });

    expect(signal.blocked).toBe(true);
  });

  it('returns blocked=true when content contains Cloudflare challenge text', () => {
    const result = makeFulfilledResult({
      title: 'Just a moment...',
      content: 'Checking your browser before accessing the site.',
    });
    const signal = detectBlocked(result);

    expect(signal.blocked).toBe(true);
    expect(signal.reason).toContain('content heuristic');
  });

  it('returns blocked=true when content contains login wall text', () => {
    const result = makeFulfilledResult({
      title: 'Sign in to continue',
      content: 'Please sign in to access this page.',
    });
    const signal = detectBlocked(result);

    expect(signal.blocked).toBe(true);
  });

  it('returns blocked=true for "Access Denied" text', () => {
    const result = makeFulfilledResult({
      title: 'Access Denied',
      content: 'You have been blocked by the security system.',
    });
    const signal = detectBlocked(result);

    expect(signal.blocked).toBe(true);
  });

  it('returns blocked=false for normal content with no error', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result);

    expect(signal.blocked).toBe(false);
  });

  it('returns blocked=false for empty content (emptyContent is handled separately)', () => {
    const result = makeFulfilledResult({ content: '' });
    const signal = detectBlocked(result);

    expect(signal.blocked).toBe(false);
  });

  it('returns blocked=false for non-blocked error codes', () => {
    const result = makeFulfilledResult();
    const signal = detectBlocked(result, { code: 'NO_CONTENT', httpStatus: 404 });

    expect(signal.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ContentQualityScorer (scoreContentQuality)
// ---------------------------------------------------------------------------

describe('scoreContentQuality', () => {
  it('scores longer content higher than shorter content', () => {
    const longResult = makeFulfilledResult({
      content: 'A'.repeat(5000),
    });
    const shortResult = makeFulfilledResult({
      content: 'A'.repeat(100),
    });

    const longCandidate: FetchCandidate = {
      provider: 'firecrawl',
      result: longResult,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const shortCandidate: FetchCandidate = {
      provider: 'firecrawl',
      result: shortResult,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const longScore = scoreContentQuality(longCandidate, 'https://example.com/page');
    const shortScore = scoreContentQuality(shortCandidate, 'https://example.com/page');

    expect(longScore.score).toBeGreaterThan(shortScore.score);
    expect(longScore.breakdown?.contentLength).toBe(5000);
    expect(shortScore.breakdown?.contentLength).toBe(100);
  });

  it('scores candidate with title higher than without title (same content length)', () => {
    const withTitle = makeFulfilledResult({ title: 'Page Title', content: 'X'.repeat(200) });
    const withoutTitle = makeFulfilledResult({ title: '', content: 'X'.repeat(200) });

    const c1: FetchCandidate = {
      provider: 'jina',
      result: withTitle,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const c2: FetchCandidate = {
      provider: 'jina',
      result: withoutTitle,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const s1 = scoreContentQuality(c1);
    const s2 = scoreContentQuality(c2);

    expect(s1.score).toBeGreaterThan(s2.score);
    expect(s1.breakdown?.hasTitle).toBe(true);
    expect(s2.breakdown?.hasTitle).toBe(false);
  });

  it('scores candidate with matching URL higher than non-matching URL', () => {
    const matching = makeFulfilledResult({ url: 'https://example.com/page' });
    const nonMatching = makeFulfilledResult({ url: 'https://other.com/page' });

    const c1: FetchCandidate = {
      provider: 'jina',
      result: matching,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const c2: FetchCandidate = {
      provider: 'jina',
      result: nonMatching,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const s1 = scoreContentQuality(c1, 'https://example.com/page');
    const s2 = scoreContentQuality(c2, 'https://example.com/page');

    expect(s1.score).toBeGreaterThan(s2.score);
    expect(s1.breakdown?.urlMatch).toBe(true);
    expect(s2.breakdown?.urlMatch).toBe(false);
  });

  it('normalizes URLs before comparing (www, trailing slash, tracking params)', () => {
    const result = makeFulfilledResult({ url: 'https://www.example.com/page/' });
    const candidate: FetchCandidate = {
      provider: 'jina',
      result,
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const score = scoreContentQuality(candidate, 'https://example.com/page');

    expect(score.breakdown?.urlMatch).toBe(true);
  });

  it('returns score -1 for null result', () => {
    const candidate: FetchCandidate = {
      provider: 'jina',
      result: null,
      diagnostics: { success: false, emptyContent: true, blocked: false },
    };

    expect(scoreContentQuality(candidate).score).toBe(-1);
  });

  it('includes providerPriority in breakdown', () => {
    const candidate: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult(),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const score = scoreContentQuality(candidate);
    // firecrawl is index 0 in DEFAULT_FETCH_PRIORITY
    expect(score.breakdown?.providerPriority).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FetchBestSelector (selectBestCandidate)
// ---------------------------------------------------------------------------

describe('selectBestCandidate', () => {
  it('returns null when all candidates are invalid', () => {
    const candidates: FetchCandidate[] = [
      {
        provider: 'firecrawl',
        result: null,
        diagnostics: { success: false, emptyContent: true, blocked: false },
      },
      {
        provider: 'jina',
        result: null,
        diagnostics: { success: false, emptyContent: true, blocked: true, blockReason: 'http 403' },
      },
    ];

    expect(selectBestCandidate(candidates, 'https://example.com/page')).toBeNull();
  });

  it('returns the highest-scoring valid candidate', () => {
    const short: FetchCandidate = {
      provider: 'jina',
      result: makeFulfilledResult({ content: 'Short content', title: 'Jina Title' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const long: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult({
        content: 'A'.repeat(5000),
        title: 'Firecrawl Title',
      }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const best = selectBestCandidate([short, long], 'https://example.com/page');

    expect(best).not.toBeNull();
    expect(best?.provider).toBe('firecrawl');
  });

  it('tie-breaks by DEFAULT_FETCH_PRIORITY order when scores are equal', () => {
    const sameContent = 'X'.repeat(200);
    const jina: FetchCandidate = {
      provider: 'jina',
      result: makeFulfilledResult({ content: sameContent, title: 'Title' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const firecrawl: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult({ content: sameContent, title: 'Title' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    // firecrawl is at index 0, jina at index 1 in DEFAULT_FETCH_PRIORITY
    const best = selectBestCandidate([jina, firecrawl], 'https://example.com/page');

    expect(best).not.toBeNull();
    expect(best?.provider).toBe('firecrawl');
  });

  it('filters out blocked candidates even if they have long content', () => {
    const blocked: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult({
        content: 'A'.repeat(5000),
        title: 'Access Denied',
      }),
      diagnostics: {
        success: false,
        emptyContent: false,
        blocked: true,
        blockReason: 'content heuristic',
      },
    };
    const valid: FetchCandidate = {
      provider: 'jina',
      result: makeFulfilledResult({ content: 'Short but valid', title: 'Good Page' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const best = selectBestCandidate([blocked, valid], 'https://example.com/page');

    expect(best).not.toBeNull();
    expect(best?.provider).toBe('jina');
  });

  it('filters out empty-content candidates', () => {
    const empty: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult({ content: '' }),
      diagnostics: { success: false, emptyContent: true, blocked: false },
    };
    const valid: FetchCandidate = {
      provider: 'jina',
      result: makeFulfilledResult({ content: 'Valid content' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    const best = selectBestCandidate([empty, valid], 'https://example.com/page');

    expect(best).not.toBeNull();
    expect(best?.provider).toBe('jina');
  });

  it('returns null for an empty candidates array', () => {
    expect(selectBestCandidate([], 'https://example.com/page')).toBeNull();
  });

  it('works with providers not in DEFAULT_FETCH_PRIORITY (lowest priority)', () => {
    const unknown: FetchCandidate = {
      provider: 'custom-provider',
      result: makeFulfilledResult({ content: 'X'.repeat(200), title: 'Title' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };
    const firecrawl: FetchCandidate = {
      provider: 'firecrawl',
      result: makeFulfilledResult({ content: 'X'.repeat(200), title: 'Title' }),
      diagnostics: { success: true, emptyContent: false, blocked: false },
    };

    // Same score, firecrawl should win due to higher priority
    const best = selectBestCandidate([unknown, firecrawl], 'https://example.com/page');

    expect(best?.provider).toBe('firecrawl');
  });
});
