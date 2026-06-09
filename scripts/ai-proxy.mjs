#!/usr/bin/env node
// Local HTTP gateway for debugging outbound AI API traffic.
//
// Usage:
//   node scripts/ai-proxy.mjs [--port <n>] [--upstream <url>] [--log <path>]
//   npm run proxy
//
// Defaults:
//   --port      8787              (env PROXY_PORT)
//   --upstream  $AI_BASE_URL      (no default; errors out if not set)
//   --log       .trellis/.runtime/ai-proxy.log
//
// Behaviour:
// - Binds 127.0.0.1 only (loopback).
// - Forwards every inbound HTTP request to `<upstream><req.url>` using global
//   fetch (Node 20+ undici). Headers are forwarded except host/connection/
//   content-length (let fetch recompute those).
// - Writes one JSONL line per inbound request and one JSONL line per upstream
//   response to the log file, and prints a one-line summary to stderr.
// - Bodies and headers are NOT masked. Run only against your own keys on your
//   own machine.

import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';

const MAX_BODY_BYTES = 64 * 1024; // 64 KiB
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--')) continue;
    const key = flag.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function resolveConfig(argv) {
  const args = parseArgs(argv);

  const portRaw = args.port ?? process.env.PROXY_PORT ?? '8787';
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port "${portRaw}": must be 1-65535`);
  }

  const upstream = args.upstream ?? process.env.PROXY_UPSTREAM ?? process.env.AI_BASE_URL;
  if (!upstream || typeof upstream !== 'string') {
    throw new Error(
      'Missing upstream. Set --upstream <url> or PROXY_UPSTREAM / AI_BASE_URL env var.',
    );
  }
  try {
    // Just validate.
    // eslint-disable-next-line no-new
    new URL(upstream);
  } catch {
    throw new Error(`Invalid --upstream "${upstream}": must be a valid URL.`);
  }

  const logPath = resolve(
    typeof args.log === 'string' ? args.log : '.trellis/.runtime/ai-proxy.log',
  );

  return {
    port,
    upstream: upstream.replace(/\/+$/, ''),
    logPath,
  };
}

function bytesOf(str) {
  return Buffer.byteLength(str, 'utf8');
}

function truncate(str) {
  if (bytesOf(str) <= MAX_BODY_BYTES) {
    return { body: str, truncated: false };
  }
  const buf = Buffer.from(str, 'utf8').subarray(0, MAX_BODY_BYTES);
  return { body: buf.toString('utf8'), truncated: true };
}

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks, total);
      resolveBody(buf);
    });
    req.on('error', rejectBody);
  });
}

function headersToObject(headers) {
  const obj = {};
  if (headers instanceof Headers) {
    for (const [k, v] of headers.entries()) {
      obj[k] = v;
    }
    return obj;
  }
  // Node IncomingMessage headers come as a plain object.
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    obj[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return obj;
}

function buildOutboundHeaders(inboundHeaders, upstreamHost) {
  const out = {};
  for (const [k, v] of Object.entries(inboundHeaders)) {
    const lower = k.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue;
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (Array.isArray(v)) {
      out[k] = v.join(', ');
    } else if (v !== undefined) {
      out[k] = String(v);
    }
  }
  // Let fetch set Host automatically based on the URL; explicitly set it only
  // if user supplied one matching the upstream — but simpler: omit, undici sets it.
  return out;
}

function filterResponseHeaders(headersObj) {
  const out = {};
  for (const [k, v] of Object.entries(headersObj)) {
    const lower = k.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === 'content-length') continue;
    out[k] = v;
  }
  return out;
}

function summarize(line) {
  process.stderr.write(`${line}\n`);
}

function createLogger(logPath) {
  mkdirSync(dirname(logPath), { recursive: true });
  const stream = createWriteStream(logPath, { flags: 'a' });
  return {
    write(record) {
      stream.write(`${JSON.stringify(record)}\n`);
    },
    end() {
      return new Promise((resolveEnd) => {
        stream.end(() => resolveEnd());
      });
    },
  };
}

async function handleRequest(req, res, ctx) {
  const id = randomUUID();
  const start = Date.now();
  const method = req.method ?? 'GET';
  const inboundHeaders = headersToObject(req.headers);
  const upstreamUrl = `${ctx.upstream}${req.url ?? '/'}`;

  let reqBodyRaw;
  try {
    reqBodyRaw = await readRequestBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger.write({
      ts: new Date().toISOString(),
      dir: 'res',
      id,
      method,
      url: upstreamUrl,
      error: `inbound read failed: ${msg}`,
      durationMs: Date.now() - start,
    });
    summarize(`[res] ${id} ERR inbound-read: ${msg}`);
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `inbound read failed: ${msg}` }));
    return;
  }

  const reqBodyStr = reqBodyRaw.toString('utf8');
  const reqBodyTrunc = truncate(reqBodyStr);

  ctx.logger.write({
    ts: new Date().toISOString(),
    dir: 'req',
    id,
    method,
    url: upstreamUrl,
    reqHeaders: inboundHeaders,
    reqBody: reqBodyTrunc.body,
    ...(reqBodyTrunc.truncated ? { truncated: true } : {}),
  });
  summarize(`[req] ${id} ${method} ${upstreamUrl} body=${bytesOf(reqBodyStr)}B`);

  const outboundHeaders = buildOutboundHeaders(inboundHeaders);
  const hasBody = method !== 'GET' && method !== 'HEAD' && reqBodyRaw.length > 0;

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method,
      headers: outboundHeaders,
      body: hasBody ? reqBodyRaw : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    ctx.logger.write({
      ts: new Date().toISOString(),
      dir: 'res',
      id,
      method,
      url: upstreamUrl,
      error: msg,
      durationMs,
    });
    summarize(`[res] ${id} ERR ${durationMs}ms ${msg}`);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
    return;
  }

  const resHeaderObj = headersToObject(upstreamRes.headers);

  let resBodyBuf;
  try {
    const arrayBuf = await upstreamRes.arrayBuffer();
    resBodyBuf = Buffer.from(arrayBuf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    ctx.logger.write({
      ts: new Date().toISOString(),
      dir: 'res',
      id,
      method,
      url: upstreamUrl,
      status: upstreamRes.status,
      resHeaders: resHeaderObj,
      error: `read upstream body failed: ${msg}`,
      durationMs,
    });
    summarize(`[res] ${id} ERR ${durationMs}ms read-upstream-body: ${msg}`);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
    return;
  }

  const resBodyStr = resBodyBuf.toString('utf8');
  const resBodyTrunc = truncate(resBodyStr);
  const durationMs = Date.now() - start;

  ctx.logger.write({
    ts: new Date().toISOString(),
    dir: 'res',
    id,
    method,
    url: upstreamUrl,
    status: upstreamRes.status,
    resHeaders: resHeaderObj,
    resBody: resBodyTrunc.body,
    durationMs,
    ...(resBodyTrunc.truncated ? { truncated: true } : {}),
  });
  summarize(`[res] ${id} ${upstreamRes.status} ${durationMs}ms body=${resBodyBuf.length}B`);

  const outboundResHeaders = filterResponseHeaders(resHeaderObj);
  res.writeHead(upstreamRes.status, outboundResHeaders);
  res.end(resBodyBuf);
}

async function main() {
  let config;
  try {
    config = resolveConfig(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ai-proxy: ${msg}\n`);
    process.exit(1);
    return;
  }

  const logger = createLogger(config.logPath);

  const server = createServer((req, res) => {
    handleRequest(req, res, { upstream: config.upstream, logger }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[ai-proxy] unhandled: ${msg}\n`);
      try {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      } catch {
        // already responded — ignore
      }
    });
  });

  await new Promise((resolveListen) => {
    server.listen(config.port, '127.0.0.1', () => resolveListen());
  });

  process.stderr.write(
    [
      `AI proxy listening on http://127.0.0.1:${config.port} -> forwarding to ${config.upstream}`,
      `Log file: ${config.logPath}`,
      `Hint: export AI_BASE_URL=http://127.0.0.1:${config.port} before launching the MCP server,`,
      'then run a search with mode=AIAggregation to capture upstream traffic.',
      '',
    ].join('\n'),
  );

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stderr.write(`\n[ai-proxy] ${signal} received, shutting down...\n`);
    server.close(() => {
      logger.end().then(() => process.exit(0));
    });
    // Hard exit safety net.
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ai-proxy] fatal: ${msg}\n`);
  process.exit(1);
});
