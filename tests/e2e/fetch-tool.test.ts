import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

function loadEnvFile(): Record<string, string> {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) result[m[1] as string] = (m[2] as string).trim().replace(/^["']|["']$/g, '');
  }
  return result;
}

const fileEnv = loadEnvFile();
const JINA_API_KEY = process.env.JINA_API_KEY ?? fileEnv.JINA_API_KEY ?? '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? fileEnv.TAVILY_API_KEY ?? '';
const EXA_API_KEY = process.env.EXA_API_KEY ?? fileEnv.EXA_API_KEY ?? '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? fileEnv.FIRECRAWL_API_KEY ?? '';

const hasAnyKey = !!JINA_API_KEY || !!TAVILY_API_KEY || !!EXA_API_KEY || !!FIRECRAWL_API_KEY;

describe.skipIf(!hasAnyKey)('e2e: fetch tool (real API)', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(ROOT, 'dist/index.js')],
      env: {
        ...process.env,
        JINA_API_KEY,
        TAVILY_API_KEY,
        EXA_API_KEY,
        FIRECRAWL_API_KEY,
      },
    });
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('fetches a single URL and returns the best result with provider field', async () => {
    const requested: string[] = [];
    if (JINA_API_KEY) requested.push('jina');
    if (TAVILY_API_KEY) requested.push('tavily');
    if (EXA_API_KEY) requested.push('exa');
    if (FIRECRAWL_API_KEY) requested.push('firecrawl');

    expect(requested.length).toBeGreaterThan(0);

    const targetUrl = 'https://example.com/';
    const result = await client.callTool({
      name: 'fetch',
      arguments: {
        url: targetUrl,
        channels: requested,
        format: 'markdown',
        timeoutMs: 60000,
      },
    });

    expect(result.isError).toBeFalsy();

    const sc = result.structuredContent as {
      url: string;
      title?: string;
      content: string;
      format: string;
      fetchedAt: string;
      provider: string;
    };

    expect(sc.url).toBeDefined();
    expect(sc.content).toBeDefined();
    expect(sc.provider).toBeDefined();
    expect(typeof sc.provider).toBe('string');
    expect(['markdown', 'text']).toContain(sc.format);
    expect(typeof sc.fetchedAt).toBe('string');

    // The best provider must have produced non-trivial content.
    expect(sc.content.length).toBeGreaterThan(50);

    // Print the result so the human reviewer can see which provider won.
    const snippet = sc.content.slice(0, 200).replace(/\n/g, ' ');
    process.stderr.write(
      `\n[fetch-e2e] best=${sc.provider} (${sc.format}, ${sc.content.length} chars): ${snippet}\n`,
    );
  });

  it('errors when explicit channels list has no available providers', async () => {
    const result = await client.callTool({
      name: 'fetch',
      arguments: {
        url: 'https://example.com/',
        channels: ['nonexistent-provider'],
      },
    });
    expect(result.isError).toBe(true);
    const sc = result.structuredContent as { error?: string };
    expect(typeof sc.error).toBe('string');
  });

  it.skipIf(!FIRECRAWL_API_KEY)(
    'fetches via default channel set (Firecrawl in defaults)',
    async () => {
      const targetUrl = 'https://example.com/';
      const result = await client.callTool({
        name: 'fetch',
        arguments: {
          url: targetUrl,
          // no channels → use default fetch ordering (firecrawl + jina first)
        },
      });
      expect(result.isError).toBeFalsy();
      const sc = result.structuredContent as {
        url: string;
        content: string;
        format: string;
        provider: string;
      };

      expect(sc.provider).toBeDefined();
      expect(sc.content.length).toBeGreaterThan(50);

      const snippet = sc.content.slice(0, 200).replace(/\n/g, ' ');
      process.stderr.write(
        `\n[fetch-e2e] best=${sc.provider} (${sc.format}, ${sc.content.length} chars): ${snippet}\n`,
      );
    },
  );
});
