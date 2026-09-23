import { getQuery, parseOptions, requireKey } from './arguments.js';
import { endpoint, requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const jina: SearchProvider = {
  help: 'platypus search jina --query <文本> [--num 5] [--type web] [--gl US]\n其他选项以 Jina /search 的 query 参数名传入, --query 映射为 q。',
  async run(args, getConfig, signal) {
    const options = parseOptions(args, 'q');
    const query = getQuery(options, 'q');
    const url = new URL(endpoint(getConfig('PLATYPUS_JINA_BASE_URL'), 'https://s.jina.ai'));
    for (const [name, value] of Object.entries(options)) {
      url.searchParams.set(name, typeof value === 'string' ? value : JSON.stringify(value));
    }
    const rawResponse = await requestJson(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${requireKey(getConfig, 'PLATYPUS_JINA_API_KEY')}`,
      },
      signal,
    });
    return { query, rawResponse };
  },
};
