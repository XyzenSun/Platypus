import { getQuery, parseOptions } from './arguments.js';
import type { SearchProvider } from './types.js';

export const gemini: SearchProvider = {
  help: 'platypus search gemini --query <文本> [--model gemini-flash-lite-latest]\n--query 映射为 Gemini contents；搜索使用 Google Search grounding，返回 Gemini 原始响应 JSON。',
  async run(args, getConfig) {
    const options = parseOptions(args);
    const query = getQuery(options);
    if (Object.keys(options).some((option) => option !== 'query' && option !== 'model')) {
      throw new Error('Gemini 搜索目前只接受 --query 和 --model');
    }
    const model = options.model;
    if (model !== undefined && (typeof model !== 'string' || !model.trim())) {
      throw new Error('--model 必须为非空模型名称');
    }
    const { searchGemini } = await import('../ai/client/gemini.js');
    return {
      query,
      rawResponse: await searchGemini(query, getConfig, model as string | undefined),
    };
  },
};
