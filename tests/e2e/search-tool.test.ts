import { execSync } from 'node:child_process';
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
const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? fileEnv.TAVILY_API_KEY ?? '';
const EXA_API_KEY = process.env.EXA_API_KEY ?? fileEnv.EXA_API_KEY ?? '';
const hasKeys = !!TAVILY_API_KEY && !!EXA_API_KEY;

describe.skipIf(!hasKeys)('e2e: search tool (real API)', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(ROOT, 'dist/index.js')],
      env: { ...process.env, TAVILY_API_KEY, EXA_API_KEY },
    });
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns real search results with correct shape', async () => {
    const result = await client.callTool({
      name: 'search',
      arguments: {
        query: 'TypeScript best practices 2025',
        numResults: 3,
        hasContent: false,
      },
    });

    expect(result.isError).toBeFalsy();

    const sc = result.structuredContent as {
      results: { url: string; title: string; snippet: string; score: number; sources: string[] }[];
      warnings: { provider: string; code: string; message: string }[];
    };

    expect(Array.isArray(sc.results)).toBe(true);
    expect(sc.results.length).toBeGreaterThan(0);
    expect(Array.isArray(sc.warnings)).toBe(true);

    for (const r of sc.results) {
      expect(typeof r.url).toBe('string');
      expect(r.url.length).toBeGreaterThan(0);
      expect(typeof r.title).toBe('string');
      expect(typeof r.snippet).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(Array.isArray(r.sources)).toBe(true);
      expect(r.sources.length).toBeGreaterThan(0);
    }

    // At least one of tavily or exa should appear in sources across all results
    const allSources = sc.results.flatMap((r) => r.sources);
    const hasTavily = allSources.includes('tavily');
    const hasExa = allSources.includes('exa');
    expect(hasTavily || hasExa).toBe(true);
  });
});
