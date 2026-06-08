import type { Config } from '../config/types.js';
import { AnthropicAIClient } from '../lib/ai-clients/anthropic.js';
import { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import { OpenAIAIClient } from '../lib/ai-clients/openai.js';
import type { AIClient, Message } from '../lib/ai-clients/types.js';
import type { SearchRequest, SearchResponse, SearchResult } from '../providers/search-types.js';

export const AI_AGGREGATION_MISSING_CONFIG_ERROR =
  '当前没有配置AI，请配置AI_API_KEY，AI_BASE_URL，AI_MODEL，AI_FORMAT 后再使用，或使用 mode=BasicAggregation 无需使用AI，BasicAggregation 会占用大量上下文，如果你有Subagent能力，询问用户是否要配置，如果是，告知用户如何配置，如果否，且你有Subagent能力，询问用户是否要派发Subagent使用本工具并将去除噪声后的结果返回';

const AI_AGGREGATION_PROMPT =
  '请帮我去除下面内容中，与 "{{query}}" 无关的内容例如导航栏,广告，备案以及与"{{query}}" 无关的内容，下面是你要处理的内容 “{{payload}}” ，请只返回去除噪声后的内容，无需做任何解释';

function createAIClient(config: Config): AIClient {
  if (!config.ai) {
    throw new Error(AI_AGGREGATION_MISSING_CONFIG_ERROR);
  }

  switch (config.ai.format) {
    case 'openai':
      return new OpenAIAIClient(config.ai);
    case 'gemini':
      return new GeminiAIClient(config.ai);
    case 'anthropic':
      return new AnthropicAIClient(config.ai);
  }
}

function buildPayload(result: SearchResult, hasContent: boolean): string {
  if (hasContent) {
    return `title: ${result.title}\ncontent: ${result.content ?? ''}`;
  }

  return result.title;
}

function buildPrompt(query: string, result: SearchResult, hasContent: boolean): string {
  return AI_AGGREGATION_PROMPT.replaceAll('{{query}}', query).replaceAll(
    '{{payload}}',
    buildPayload(result, hasContent),
  );
}

async function cleanResult(
  client: AIClient,
  query: string,
  result: SearchResult,
  hasContent: boolean,
  timeoutMs: number,
): Promise<SearchResult> {
  const prompt = buildPrompt(query, result, hasContent);
  const messages: Message[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await client.chat(messages, {
      signal: AbortSignal.timeout(timeoutMs),
      retryDelays: [1000],
    });
    const cleanedText = response.content.trim();
    if (!cleanedText) {
      return result;
    }

    if (hasContent) {
      return { ...result, content: cleanedText };
    }

    return { ...result, title: cleanedText };
  } catch {
    return result;
  }
}

export async function maybeRunAIAggregation(
  config: Config,
  request: Pick<SearchRequest, 'mode' | 'query' | 'hasContent'>,
  response: SearchResponse,
  client?: AIClient,
): Promise<SearchResponse> {
  if (request.mode !== 'AIAggregation') {
    return response;
  }

  const resolvedClient = client ?? createAIClient(config);
  const timeoutMs = config.ai?.timeoutMs ?? 10_000;
  const cleanedResults: SearchResult[] = [];

  for (const result of response.results) {
    cleanedResults.push(
      await cleanResult(resolvedClient, request.query, result, request.hasContent, timeoutMs),
    );
  }

  return {
    ...response,
    results: cleanedResults,
  };
}
