import { getQuery, parseOptions, requireKey } from './arguments.js';
import { endpoint, requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const searxng: SearchProvider = {
  help: 'platypus search searxng --query <文本> [--language en] [--engines google,bing] [--pageno 1]\n实例必须启用 JSON 输出；其余选项使用 SearXNG /search 的 URL 参数名。',
  async run(args, getConfig) {
    const options = parseOptions(args, 'q');
    const query = getQuery(options, 'q');
    const baseUrl = requireKey(getConfig, 'PLATYPUS_SEARXNG_BASE_URL');
    const url = new URL(endpoint(baseUrl, baseUrl));
    if ('format' in options && options.format !== 'json') {
      throw new Error('SearXNG 的原始 JSON 输出需要 --format json');
    }
    url.searchParams.set('format', 'json');
    for (const [name, value] of Object.entries(options)) {
      url.searchParams.set(name, typeof value === 'string' ? value : JSON.stringify(value));
    }
    const rawResponse = await requestJson(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    return { query, rawResponse };
  },
};
