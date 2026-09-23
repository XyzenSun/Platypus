import { getQuery, parseOptions, requireKey } from './arguments.js';
import { requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const ollama: SearchProvider = {
  help: 'platypus search ollama --query <文本> [--max_results 5]\n参数使用 Ollama Web Search 的 JSON 字段名。',
  async run(args, getConfig) {
    const body = parseOptions(args);
    const query = getQuery(body);
    const baseUrl = getConfig('PLATYPUS_OLLAMA_BASE_URL') ?? 'https://ollama.com';
    const rawResponse = await requestJson(`${baseUrl.replace(/\/+$/u, '')}/api/web_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireKey(getConfig, 'PLATYPUS_OLLAMA_API_KEY')}`,
      },
      body: JSON.stringify(body),
    });
    return { query, rawResponse };
  },
};
