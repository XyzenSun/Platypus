import { getQuery, parseOptions, requireKey } from './arguments.js';
import { requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const firecrawl: SearchProvider = {
  help: 'platypus search firecrawl --query <文本> [--limit 5] [--scrapeOptions \'{"formats":[{"type":"markdown"}] }\']\n其余选项使用 Firecrawl v2 Search 的 JSON 字段名；数组和对象使用 JSON 字符串。',
  async run(args, getConfig) {
    const body = parseOptions(args);
    const query = getQuery(body);
    const baseUrl = getConfig('PLATYPUS_FIRECRAWL_BASE_URL') ?? 'https://api.firecrawl.dev';
    const rawResponse = await requestJson(`${baseUrl.replace(/\/+$/u, '')}/v2/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireKey(getConfig, 'PLATYPUS_FIRECRAWL_API_KEY')}`,
      },
      body: JSON.stringify(body),
    });
    return { query, rawResponse };
  },
};
