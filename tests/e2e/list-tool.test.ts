import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

function spawnMcpServer(env: Record<string, string> = {}) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(ROOT, 'dist/index.js')],
    env: { ...process.env, ...env },
  });
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  return { client, transport };
}

describe('e2e: list tool', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const spawned = spawnMcpServer({ TAVILY_API_KEY: 'test-key', EXA_API_KEY: 'test-key' });
    client = spawned.client;
    transport = spawned.transport;
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('exposes exactly 3 tools: search, fetch, list', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['fetch', 'list', 'search']);
  });

  it('list tool returns expected shape with configured providers', async () => {
    const result = await client.callTool({ name: 'list', arguments: {} });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as Record<string, unknown>;
    expect(Array.isArray(sc.search)).toBe(true);
    expect(Array.isArray(sc.fetch)).toBe(true);
    // with TAVILY_API_KEY + EXA_API_KEY, both should appear in search
    expect(sc.search).toContain('tavily');
    expect(sc.search).toContain('exa');
  });

  it('list tool with no providers returns empty arrays', async () => {
    const spawned = spawnMcpServer({});
    const emptyClient = spawned.client;
    await emptyClient.connect(spawned.transport);
    try {
      const result = await emptyClient.callTool({ name: 'list', arguments: {} });
      const sc = result.structuredContent as Record<string, unknown>;
      expect(sc.search).toEqual([]);
      expect(sc.fetch).toEqual([]);
    } finally {
      await emptyClient.close();
    }
  });
});
