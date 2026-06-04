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

  it('fetches a URL via available providers and returns byProvider view', async () => {
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
        urls: [targetUrl],
        channels: requested,
        format: 'markdown',
        timeoutMs: 60000,
      },
    });

    expect(result.isError).toBeFalsy();

    const sc = result.structuredContent as {
      results: Record<
        string,
        Record<
          string,
          { url: string; title?: string; content: string; format: string; fetchedAt: string }
        >
      >;
      warnings: { provider: string; url: string; code: string; message: string }[];
    };

    expect(sc.results).toBeDefined();
    expect(sc.results[targetUrl]).toBeDefined();
    expect(Array.isArray(sc.warnings)).toBe(true);

    const bucket = sc.results[targetUrl];
    expect(bucket).toBeDefined();
    if (!bucket) return;

    // Print snippets so the human reviewer can see provider differences.
    for (const provider of requested) {
      const entry = bucket[provider];
      if (entry) {
        const snippet = entry.content.slice(0, 200).replace(/\n/g, ' ');
        process.stderr.write(
          `\n[fetch-e2e] ${provider} (${entry.format}, ${entry.content.length} chars): ${snippet}\n`,
        );
      } else {
        const w = sc.warnings.find((x) => x.provider === provider && x.url === targetUrl);
        process.stderr.write(
          `\n[fetch-e2e] ${provider} failed: ${w?.code ?? 'unknown'} ${w?.message ?? ''}\n`,
        );
      }
    }

    // At least one provider must have produced non-trivial content.
    const successes = requested
      .map((p) => bucket[p])
      .filter((e): e is NonNullable<typeof e> => !!e && e.content.length > 50);
    expect(successes.length).toBeGreaterThan(0);

    // Verify shape on each success.
    for (const entry of successes) {
      expect(typeof entry.url).toBe('string');
      expect(typeof entry.content).toBe('string');
      expect(['markdown', 'text']).toContain(entry.format);
      expect(typeof entry.fetchedAt).toBe('string');
    }
  });

  it('errors when explicit channels list has no available providers', async () => {
    // Pick a definitely-unconfigured channel name.
    const result = await client.callTool({
      name: 'fetch',
      arguments: {
        urls: ['https://example.com/'],
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
          urls: [targetUrl],
          // no channels → use defaultFetchChannels (firecrawl + jina)
        },
      });
      expect(result.isError).toBeFalsy();
      const sc = result.structuredContent as {
        results: Record<
          string,
          Record<
            string,
            { url: string; title?: string; content: string; format: string; fetchedAt: string }
          >
        >;
      };
      const bucket = sc.results[targetUrl];
      expect(bucket).toBeDefined();
      // Firecrawl must have produced content (jina may fail in sandbox).
      const fc = bucket?.firecrawl;
      expect(fc).toBeDefined();
      if (fc) {
        expect(fc.content.length).toBeGreaterThan(50);
        const snippet = fc.content.slice(0, 200).replace(/\n/g, ' ');
        process.stderr.write(
          `\n[fetch-e2e] firecrawl (${fc.format}, ${fc.content.length} chars): ${snippet}\n`,
        );
      }
    },
  );
});