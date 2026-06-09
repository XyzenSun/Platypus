import { describe, expect, it, vi } from 'vitest';
import {
  AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE,
  AI_AGGREGATION_FAIL_PREFIX,
  AI_AGGREGATION_MISSING_CONFIG_ERROR,
  AI_AGGREGATION_SUCCESS_PREFIX,
  AI_AGGREGATION_WARNING_CODE,
  AI_AGGREGATION_WARNING_MESSAGE_MAX,
  AI_AGGREGATION_WARNING_PROVIDER,
  maybeRunAIAggregation,
} from '../../src/aggregator/ai-aggregation.js';
import type { AIClient, Message } from '../../src/lib/ai-clients/types.js';
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
} from '../../src/providers/search-types.js';

const logMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/server/logger.js', () => ({
  log: logMock,
  logger: { info: vi.fn(), error: vi.fn() },
}));

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'r1',
    title: 'platypus title',
    url: 'https://example.test/r1',
    content: 'noisy <ad>content</ad> for platypus',
    score: 0.9,
    rank: 1,
    sources: ['exa'],
    ...overrides,
  };
}

function makeBaseResponse(result: SearchResult): SearchResponse {
  return {
    results: [result],
    warnings: [],
  };
}

const baseRequest: Pick<SearchRequest, 'mode' | 'query' | 'hasContent'> = {
  mode: 'AIAggregation',
  query: 'platypus',
  hasContent: true,
};

const baseConfig = {
  searchPostProcess: {
    providerWeights: {},
    domainBlacklistUrl: 'about:blank',
    domainBlacklist: new Set<string>(),
  },
  ai: {
    apiKey: 'k',
    baseUrl: 'https://example.test',
    model: 'm',
    format: 'openai' as const,
    timeoutMs: 1000,
  },
};

describe('maybeRunAIAggregation (cleanResult behaviour)', () => {
  it('invokes client.chat with exactly one user-role message', async () => {
    logMock.mockClear();

    const chat = vi.fn().mockResolvedValue({ content: 'cleaned content' });
    const client: AIClient = { id: 'fake', chat };

    const result = makeResult();
    const response = await maybeRunAIAggregation(
      baseConfig,
      baseRequest,
      makeBaseResponse(result),
      client,
    );

    expect(chat).toHaveBeenCalledTimes(1);
    const callArgs = chat.mock.calls[0] as [Message[], unknown];
    const messages = callArgs[0];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toContain('platypus');

    expect(response.results).toHaveLength(1);
  });

  // AC1: success path adds the Success prefix to the cleaned content; warnings
  // length stays the same as the input response.
  it('prefixes successful cleanings with AI_AGGREGATION_SUCCESS_PREFIX and leaves warnings untouched', async () => {
    logMock.mockClear();

    const chat = vi.fn().mockResolvedValue({ content: 'cleaned' });
    const client: AIClient = { id: 'fake', chat };

    const result = makeResult();
    const inputResponse = makeBaseResponse(result);
    const response = await maybeRunAIAggregation(baseConfig, baseRequest, inputResponse, client);

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.content).toBe(`${AI_AGGREGATION_SUCCESS_PREFIX}cleaned`);
    expect(response.warnings).toHaveLength(inputResponse.warnings.length);
  });

  // AC2: reject -> Fail prefix + original content, and a single AI_CLEAN_FAILED
  // warning carrying the error's message verbatim (boom fits inside the 50-char
  // truncation budget, so it should pass through untouched).
  it('falls back to Fail prefix + warning when client.chat rejects', async () => {
    logMock.mockClear();

    const err = new Error('boom');
    const chat = vi.fn().mockRejectedValue(err);
    const client: AIClient = { id: 'fake', chat };

    const original = makeResult();
    const response = await maybeRunAIAggregation(
      baseConfig,
      baseRequest,
      makeBaseResponse(original),
      client,
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.content).toBe(
      `${AI_AGGREGATION_FAIL_PREFIX}${original.content ?? ''}`,
    );
    // Untouched fields (proves the prefix is the only mutation).
    expect(response.results[0]?.id).toBe(original.id);
    expect(response.results[0]?.title).toBe(original.title);
    expect(response.results[0]?.url).toBe(original.url);

    expect(response.warnings).toHaveLength(1);
    expect(response.warnings[0]).toEqual({
      provider: AI_AGGREGATION_WARNING_PROVIDER,
      code: AI_AGGREGATION_WARNING_CODE,
      message: 'boom',
    });

    // log() called at least once with a message that contains the original error message.
    expect(logMock).toHaveBeenCalled();
    const calls = logMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((msg) => msg.includes('boom'))).toBe(true);
    expect(calls.some((msg) => msg.includes('[ai-aggregation]'))).toBe(true);
  });

  // AC3: an 80-char error message must be truncated to exactly 50 characters,
  // with no trailing ellipsis appended.
  it('truncates the warning message to AI_AGGREGATION_WARNING_MESSAGE_MAX characters without ellipsis', async () => {
    logMock.mockClear();

    const longMessage = 'x'.repeat(80);
    const chat = vi.fn().mockRejectedValue(new Error(longMessage));
    const client: AIClient = { id: 'fake', chat };

    const response = await maybeRunAIAggregation(
      baseConfig,
      baseRequest,
      makeBaseResponse(makeResult()),
      client,
    );

    expect(response.warnings).toHaveLength(1);
    const warningMessage = response.warnings[0]?.message ?? '';
    expect(Array.from(warningMessage)).toHaveLength(AI_AGGREGATION_WARNING_MESSAGE_MAX);
    expect(warningMessage.endsWith('...')).toBe(false);
    expect(warningMessage).toBe('x'.repeat(AI_AGGREGATION_WARNING_MESSAGE_MAX));
  });

  // AC4: empty response is treated as a failure (Fail prefix + warning with
  // canonical "ai returned empty content" message; log() must still fire).
  it('treats an empty AI response as failure with a canonical warning message', async () => {
    logMock.mockClear();

    const chat = vi.fn().mockResolvedValue({ content: '   ' });
    const client: AIClient = { id: 'fake', chat };

    const original = makeResult();
    const response = await maybeRunAIAggregation(
      baseConfig,
      baseRequest,
      makeBaseResponse(original),
      client,
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.content).toBe(
      `${AI_AGGREGATION_FAIL_PREFIX}${original.content ?? ''}`,
    );

    expect(response.warnings).toHaveLength(1);
    expect(response.warnings[0]).toEqual({
      provider: AI_AGGREGATION_WARNING_PROVIDER,
      code: AI_AGGREGATION_WARNING_CODE,
      message: AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE,
    });

    expect(logMock).toHaveBeenCalled();
    const calls = logMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((msg) => msg.includes('[ai-aggregation]'))).toBe(true);
    expect(calls.some((msg) => msg.includes(AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE))).toBe(true);
  });

  // AC5: hasContent=false routes prefixing/fallback to the `title` field.
  it('applies prefixes on title when hasContent is false', async () => {
    logMock.mockClear();

    const chatSuccess = vi.fn().mockResolvedValue({ content: 'short' });
    const clientSuccess: AIClient = { id: 'fake', chat: chatSuccess };

    const original = makeResult();
    const successResponse = await maybeRunAIAggregation(
      baseConfig,
      { ...baseRequest, hasContent: false },
      makeBaseResponse(original),
      clientSuccess,
    );

    expect(successResponse.results[0]?.title).toBe(`${AI_AGGREGATION_SUCCESS_PREFIX}short`);
    expect(successResponse.results[0]?.content).toBe(original.content);
    expect(successResponse.warnings).toHaveLength(0);

    logMock.mockClear();
    const chatReject = vi.fn().mockRejectedValue(new Error('boom'));
    const clientReject: AIClient = { id: 'fake', chat: chatReject };

    const failResponse = await maybeRunAIAggregation(
      baseConfig,
      { ...baseRequest, hasContent: false },
      makeBaseResponse(original),
      clientReject,
    );

    expect(failResponse.results[0]?.title).toBe(`${AI_AGGREGATION_FAIL_PREFIX}${original.title}`);
    expect(failResponse.results[0]?.content).toBe(original.content);
    expect(failResponse.warnings).toHaveLength(1);
    expect(failResponse.warnings[0]).toEqual({
      provider: AI_AGGREGATION_WARNING_PROVIDER,
      code: AI_AGGREGATION_WARNING_CODE,
      message: 'boom',
    });
  });

  // AC6: BasicAggregation path must not touch results or warnings.
  it('still returns the response unchanged when mode is not AIAggregation', async () => {
    logMock.mockClear();

    const chat = vi.fn();
    const client: AIClient = { id: 'fake', chat };

    const original = makeResult();
    const inputResponse = makeBaseResponse(original);
    const response = await maybeRunAIAggregation(
      baseConfig,
      { ...baseRequest, mode: 'BasicAggregation' },
      inputResponse,
      client,
    );

    expect(chat).not.toHaveBeenCalled();
    expect(response.results).toEqual([original]);
    expect(response.warnings).toEqual(inputResponse.warnings);
  });

  // AC7: multiple failing results -> one warning per failure, in order.
  it('emits one warning per failed result when several results fail in sequence', async () => {
    logMock.mockClear();

    const chat = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));
    const client: AIClient = { id: 'fake', chat };

    const first = makeResult({ id: 'r1', url: 'https://example.test/r1' });
    const second = makeResult({ id: 'r2', url: 'https://example.test/r2' });
    const inputResponse: SearchResponse = {
      results: [first, second],
      warnings: [],
    };

    const response = await maybeRunAIAggregation(baseConfig, baseRequest, inputResponse, client);

    expect(response.results).toHaveLength(2);
    expect(response.results[0]?.content).toBe(
      `${AI_AGGREGATION_FAIL_PREFIX}${first.content ?? ''}`,
    );
    expect(response.results[1]?.content).toBe(
      `${AI_AGGREGATION_FAIL_PREFIX}${second.content ?? ''}`,
    );

    expect(response.warnings).toHaveLength(2);
    expect(response.warnings[0]?.message).toBe('first failure');
    expect(response.warnings[1]?.message).toBe('second failure');
    expect(response.warnings.every((w) => w.provider === AI_AGGREGATION_WARNING_PROVIDER)).toBe(
      true,
    );
    expect(response.warnings.every((w) => w.code === AI_AGGREGATION_WARNING_CODE)).toBe(true);
  });

  it('throws AI_AGGREGATION_MISSING_CONFIG_ERROR when config.ai is missing', async () => {
    logMock.mockClear();

    const configWithoutAi = {
      searchPostProcess: {
        providerWeights: {},
        domainBlacklistUrl: 'about:blank',
        domainBlacklist: new Set<string>(),
      },
    };

    await expect(
      maybeRunAIAggregation(configWithoutAi, baseRequest, makeBaseResponse(makeResult())),
    ).rejects.toThrowError(AI_AGGREGATION_MISSING_CONFIG_ERROR);
  });

  it('skips client creation entirely when mode is not AIAggregation even without config.ai', async () => {
    logMock.mockClear();

    const configWithoutAi = {
      searchPostProcess: {
        providerWeights: {},
        domainBlacklistUrl: 'about:blank',
        domainBlacklist: new Set<string>(),
      },
    };

    const original = makeResult();
    const response = await maybeRunAIAggregation(
      configWithoutAi,
      { ...baseRequest, mode: 'BasicAggregation' },
      makeBaseResponse(original),
    );

    expect(response.results).toEqual([original]);
  });
});
