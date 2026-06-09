import { describe, expect, it, vi } from 'vitest';

const constructorCalls: Array<{ apiKey?: string; baseURL?: string; baseUrl?: string }> = [];

vi.mock('openai', () => {
  class FakeOpenAI {
    public apiKey: string;
    public baseURL?: string;
    public chat = {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }] }),
      },
    };
    constructor(opts: { apiKey: string; baseURL?: string; baseUrl?: string }) {
      constructorCalls.push(opts);
      this.apiKey = opts.apiKey;
      this.baseURL = opts.baseURL;
    }
  }
  return { default: FakeOpenAI };
});

describe('OpenAIAIClient', () => {
  it('maps the external baseUrl option to the SDK baseURL field', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test', baseUrl: 'https://example.test' });

    expect(constructorCalls).toHaveLength(1);
    const opts = constructorCalls[0];
    expect(opts).toBeDefined();
    expect(opts?.apiKey).toBe('sk-test');
    expect(opts?.baseURL).toBe('https://example.test');
    // The misspelled lower-case variant must not leak through to the SDK.
    expect(opts?.baseUrl).toBeUndefined();
  });

  it('omits baseURL when no baseUrl is provided', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test' });

    expect(constructorCalls).toHaveLength(1);
    expect(constructorCalls[0]?.baseURL).toBeUndefined();
    expect(constructorCalls[0]?.baseUrl).toBeUndefined();
  });
});
