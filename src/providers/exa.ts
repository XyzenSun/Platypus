import { getQuery, parseOptions, requireKey } from './arguments.js';
import { endpoint, requestJson } from './request.js';
import type { SearchProvider } from './types.js';

export const exa: SearchProvider = {
  help: 'platypus search exa --query <文本> [--numResults 10] [--type auto] [--contents \'{"text":true}\']\n其他选项以 Exa /search 的 JSON 字段名传入, 数组和对象使用 JSON 字符串。',
  async run(args, getConfig, signal) {
    const body = parseOptions(args);
    const query = getQuery(body);
    const rawResponse = await requestJson(
      endpoint(getConfig('PLATYPUS_EXA_BASE_URL'), 'https://api.exa.ai'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': requireKey(getConfig, 'PLATYPUS_EXA_API_KEY'),
        },
        body: JSON.stringify(body),
        signal,
      },
    );
    return { query, rawResponse };
  },
};
