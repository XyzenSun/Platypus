#!/usr/bin/env node
// End-to-end verification: when AI is NOT configured (no AI_API_KEY in env),
// invoking search with mode=AIAggregation must surface the
// AI_AGGREGATION_MISSING_CONFIG_ERROR message via the MCP tool response
// (isError=true + structuredContent.error contains the message).
//
// Run: node scripts/verify-missing-ai-config.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_PREFIX = '当前没有配置AI，请配置AI_API_KEY';

// Read .env once so we can carry over non-AI keys (e.g. EXA_API_KEY) to the child.
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = (m[2] ?? '').trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = loadEnvFile();

// Build a child env that intentionally OMITS every AI_* variable, so the
// server's loadConfig() leaves config.ai = undefined.
const childEnv = {};
for (const [k, v] of Object.entries({ ...process.env, ...fileEnv })) {
  if (k.startsWith('AI_')) continue; // strip AI_API_KEY / AI_BASE_URL / AI_MODEL / AI_FORMAT / AI_TIMEOUT_MS
  childEnv[k] = v;
}
// Provide EXA only — enough for the search step to succeed before AI aggregation runs.
if (!childEnv.EXA_API_KEY) {
  console.error(
    '[verify] EXA_API_KEY missing in env or .env; aborting (need at least one search provider).',
  );
  process.exit(2);
}

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(ROOT, 'dist/index.js')],
  env: childEnv,
});

const client = new Client({ name: 'verify-missing-ai-config', version: '0.0.1' });

try {
  await client.connect(transport);

  const result = await client.callTool({
    name: 'search',
    arguments: {
      query: 'platypus',
      mode: 'AIAggregation',
      perChannelMaxResults: 1,
      hasContent: false,
    },
  });

  console.log('--- raw tool result ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('-----------------------');

  const sc = result.structuredContent ?? {};
  const errMsg = typeof sc.error === 'string' ? sc.error : '';

  const okIsError = result.isError === true;
  const okMessage = errMsg.startsWith(EXPECTED_PREFIX);

  if (okIsError && okMessage) {
    console.log('[verify] PASS — server returned the configured missing-AI error.');
    console.log('[verify] error message:', errMsg);
    process.exitCode = 0;
  } else {
    console.error('[verify] FAIL — did not get expected missing-AI error.');
    console.error('[verify] isError:', result.isError);
    console.error('[verify] errMsg :', errMsg);
    process.exitCode = 1;
  }
} catch (err) {
  console.error('[verify] driver error:', err);
  process.exitCode = 2;
} finally {
  await client.close().catch(() => {});
}
