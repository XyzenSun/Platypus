import { getQuery, parseOptions, requireKey } from './arguments.js';
import { endpoint, requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const tavily: SearchProvider = {
  help: 'platypus search tavily --query <文本> [--max_results 5] [--search_depth advanced] [--include_domains \'["example.com"]\']\n其他选项以 Tavily /search 的 JSON 字段名传入, 数组和对象使用 JSON 字符串。',
  async run(args, getConfig) {
    const body = parseOptions(args);
    const query = getQuery(body);
    const rawResponse = await requestJson(
      endpoint(getConfig('PLATYPUS_TAVILY_BASE_URL'), 'https://api.tavily.com'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requireKey(getConfig, 'PLATYPUS_TAVILY_API_KEY')}`,
        },
        body: JSON.stringify(body),
      },
    );
    return { query, rawResponse };
  },
};
