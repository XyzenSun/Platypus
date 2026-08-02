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
  it('maps the external baseUrl option to the SDK baseURL field with /v1 appended', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test', baseUrl: 'https://example.test' });

    expect(constructorCalls).toHaveLength(1);
    const opts = constructorCalls[0];
    expect(opts).toBeDefined();
    expect(opts?.apiKey).toBe('sk-test');
    expect(opts?.baseURL).toBe('https://example.test/v1');
    // The misspelled lower-case variant must not leak through to the SDK.
    expect(opts?.baseUrl).toBeUndefined();
  });

  it('appends /v1 to a host-only baseUrl', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test', baseUrl: 'https://api.openai.com' });

    expect(constructorCalls[0]?.baseURL).toBe('https://api.openai.com/v1');
  });

  it('appends /v1 to a sub-path baseUrl', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test', baseUrl: 'https://a.com/a/c/d' });

    expect(constructorCalls[0]?.baseURL).toBe('https://a.com/a/c/d/v1');
  });

  it('strips trailing slash before appending /v1', async () => {
    constructorCalls.length = 0;
    const { OpenAIAIClient } = await import('../../src/lib/ai-clients/openai.js');
    new OpenAIAIClient({ apiKey: 'sk-test', baseUrl: 'https://a.com/a/c/d/' });

    expect(constructorCalls[0]?.baseURL).toBe('https://a.com/a/c/d/v1');
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
