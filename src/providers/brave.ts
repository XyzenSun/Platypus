import { getQuery, parseOptions, requireKey } from './arguments.js';
import { requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const brave: SearchProvider = {
  help: 'platypus search brave --query <文本> [--count 5] [--country US] [--search_lang en]\n其余选项使用 Brave Web Search 的 URL 参数名。',
  async run(args, getConfig) {
    const options = parseOptions(args, 'q');
    const query = getQuery(options, 'q');
    const baseUrl = getConfig('PLATYPUS_BRAVE_BASE_URL') ?? 'https://api.search.brave.com';
    const url = new URL(`${baseUrl.replace(/\/+$/u, '')}/res/v1/web/search`);
    for (const [name, value] of Object.entries(options)) {
      url.searchParams.set(name, typeof value === 'string' ? value : JSON.stringify(value));
    }
    const rawResponse = await requestJson(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': requireKey(getConfig, 'PLATYPUS_BRAVE_API_KEY'),
      },
    });
    return { query, rawResponse };
  },
};
