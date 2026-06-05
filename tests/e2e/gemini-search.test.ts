import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GEMINI_SUMMARY_URL } from '../../src/providers/gemini.js';

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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? fileEnv.GEMINI_API_KEY ?? '';
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL ?? fileEnv.GEMINI_BASE_URL ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? fileEnv.GEMINI_MODEL ?? '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? fileEnv.TAVILY_API_KEY ?? '';

describe.skipIf(!GEMINI_API_KEY)('e2e: gemini search (real API)', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(ROOT, 'dist/index.js')],
      env: {
        ...process.env,
        GEMINI_API_KEY,
        ...(GEMINI_BASE_URL ? { GEMINI_BASE_URL } : {}),
        ...(GEMINI_MODEL ? { GEMINI_MODEL } : {}),
        ...(TAVILY_API_KEY ? { TAVILY_API_KEY } : {}),
      },
    });
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns a single AI summary result when channels=[gemini]', async () => {
    const result = await client.callTool({
      name: 'search',
      arguments: {
        query: 'Who won Euro 2024?',
        channels: ['gemini'],
        hasContent: true,
        timeoutMs: 60000,
      },
    });

    expect(result.isError).toBeFalsy();

    const sc = result.structuredContent as {
      results: {
        url: string;
        title: string;
        content?: string;
        score: number;
        rank: number;
        sources: string[];
      }[];
      warnings: { provider: string; code: string; message: string }[];
    };

    expect(Array.isArray(sc.results)).toBe(true);
    expect(sc.results.length).toBeGreaterThanOrEqual(1);

    const top = sc.results[0];
    expect(top).toBeDefined();
    if (!top) return;

    expect(top.url).toBe(GEMINI_SUMMARY_URL);
    expect(top.sources).toEqual(['gemini']);
    expect(top.score).toBe(0.5);
    // hasContent=true: content is the full answer, title is first 100 chars
    expect(typeof top.content).toBe('string');
    expect((top.content ?? '').length).toBeGreaterThan(50);
    expect(top.title.length).toBeLessThanOrEqual(100);

    process.stderr.write(
      `\n[gemini-e2e] gemini-only summary (${(top.content ?? '').length} chars): ${(top.content ?? '').slice(0, 200).replace(/\n/g, ' ')}\n`,
    );
  });

  it.skipIf(!TAVILY_API_KEY)(
    'mixed channels: gemini + tavily -> gemini score = mean(others), not 0.5, not 1/61',
    async () => {
      const result = await client.callTool({
        name: 'search',
        arguments: {
          query: 'Who won Euro 2024?',
          channels: ['tavily', 'gemini'],
          hasContent: false,
          perChannelMaxResults: 5,
          timeoutMs: 60000,
        },
      });

      expect(result.isError).toBeFalsy();
      const sc = result.structuredContent as {
        results: { url: string; score: number; sources: string[] }[];
        warnings: unknown[];
      };
      const gem = sc.results.find((r) => r.sources.length === 1 && r.sources[0] === 'gemini');
      expect(gem).toBeDefined();
      if (!gem) return;

      const others = sc.results.filter(
        (r) => !(r.sources.length === 1 && r.sources[0] === 'gemini'),
      );
      expect(others.length).toBeGreaterThan(0);
      const expectedAvg = others.reduce((s, r) => s + r.score, 0) / others.length;

      // Score should be the mean of other RRF scores; not the lone-source 0.5.
      expect(gem.score).not.toBe(0.5);
      expect(gem.score).toBeCloseTo(expectedAvg, 6);
      // Also clearly not the un-boosted RRF rank-1 (1/61 ≈ 0.0164) of a single
      // unique URL, unless that's exactly what mean(others) lands at.
      process.stderr.write(
        `\n[gemini-e2e] mixed: gemini score=${gem.score.toFixed(6)} avg(others)=${expectedAvg.toFixed(6)}\n`,
      );
    },
  );
});
