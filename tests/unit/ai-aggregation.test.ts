import { describe, expect, it, vi } from 'vitest';
import { maybeRunAIAggregation } from '../../src/aggregator/ai-aggregation.js';
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
    expect(response.results[0]?.content).toBe('cleaned content');
  });

  it('logs and returns original result when client.chat rejects', async () => {
    logMock.mockClear();

    const err = new Error('upstream blew up');
    const chat = vi.fn().mockRejectedValue(err);
    const client: AIClient = { id: 'fake', chat };

    const original = makeResult();
    const response = await maybeRunAIAggregation(
      baseConfig,
      baseRequest,
      makeBaseResponse(original),
      client,
    );

    // Original result preserved untouched.
    expect(response.results).toEqual([original]);

    // log() called at least once with a message that contains the original error message.
    expect(logMock).toHaveBeenCalled();
    const calls = logMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((msg) => msg.includes('upstream blew up'))).toBe(true);
    expect(calls.some((msg) => msg.includes('[ai-aggregation]'))).toBe(true);
  });

  it('still returns the response unchanged when mode is not AIAggregation', async () => {
    logMock.mockClear();

    const chat = vi.fn();
    const client: AIClient = { id: 'fake', chat };

    const original = makeResult();
    const response = await maybeRunAIAggregation(
      baseConfig,
      { ...baseRequest, mode: 'BasicAggregation' },
      makeBaseResponse(original),
      client,
    );

    expect(chat).not.toHaveBeenCalled();
    expect(response.results).toEqual([original]);
  });
});
