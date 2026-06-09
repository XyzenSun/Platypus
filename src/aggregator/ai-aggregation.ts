import type { Config } from '../config/types.js';
import { AnthropicAIClient } from '../lib/ai-clients/anthropic.js';
import { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import { OpenAIAIClient } from '../lib/ai-clients/openai.js';
import type { AIClient, Message } from '../lib/ai-clients/types.js';
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchWarning,
} from '../providers/search-types.js';
import { log } from '../server/logger.js';

export const AI_AGGREGATION_MISSING_CONFIG_ERROR =
  '当前没有配置AI，请配置AI_API_KEY，AI_BASE_URL，AI_MODEL，AI_FORMAT 后再使用，或使用 mode=BasicAggregation 无需使用AI，BasicAggregation 会占用大量上下文，如果你有Subagent能力，询问用户是否要配置，如果是，告知用户如何配置，如果否，且你有Subagent能力，询问用户是否要派发Subagent使用本工具并将去除噪声后的结果返回';

const AI_AGGREGATION_PROMPT =
  '请帮我去除下面内容中，与 "{{query}}" 无关的内容例如导航栏,广告，备案以及与"{{query}}" 无关的内容，下面是你要处理的内容 “{{payload}}” ，请只返回去除噪声后的内容，无需做任何解释';

export const AI_AGGREGATION_SUCCESS_PREFIX = '[AIAggregation Success]: ';
export const AI_AGGREGATION_FAIL_PREFIX = '[AIAggregation Fail, Origin Content/Title]: ';
export const AI_AGGREGATION_WARNING_PROVIDER = 'ai-aggregation';
export const AI_AGGREGATION_WARNING_CODE = 'AI_CLEAN_FAILED';
export const AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE = 'ai returned empty content';
export const AI_AGGREGATION_WARNING_MESSAGE_MAX = 50;

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

/**
 * Truncate a warning message to {@link AI_AGGREGATION_WARNING_MESSAGE_MAX} characters,
 * counting actual Unicode characters (so multi-byte / emoji are treated as one). No
 * trailing ellipsis is appended — the tail is simply discarded (per prd Decisions).
 */
function truncateWarningMessage(raw: string): string {
  return Array.from(raw).slice(0, AI_AGGREGATION_WARNING_MESSAGE_MAX).join('');
}

function buildFailureWarning(rawMessage: string): SearchWarning {
  return {
    provider: AI_AGGREGATION_WARNING_PROVIDER,
    code: AI_AGGREGATION_WARNING_CODE,
    message: truncateWarningMessage(rawMessage),
  };
}

function applyFailPrefix(result: SearchResult, hasContent: boolean): SearchResult {
  if (hasContent) {
    return {
      ...result,
      content: `${AI_AGGREGATION_FAIL_PREFIX}${result.content ?? ''}`,
    };
  }

  return {
    ...result,
    title: `${AI_AGGREGATION_FAIL_PREFIX}${result.title}`,
  };
}

function applySuccessPrefix(
  result: SearchResult,
  hasContent: boolean,
  cleanedText: string,
): SearchResult {
  const prefixed = `${AI_AGGREGATION_SUCCESS_PREFIX}${cleanedText}`;

  if (hasContent) {
    return { ...result, content: prefixed };
  }

  return { ...result, title: prefixed };
}

interface CleanResultOutcome {
  result: SearchResult;
  warning?: SearchWarning;
}

async function cleanResult(
  client: AIClient,
  query: string,
  result: SearchResult,
  hasContent: boolean,
  timeoutMs: number,
): Promise<CleanResultOutcome> {
  const prompt = buildPrompt(query, result, hasContent);
  const messages: Message[] = [{ role: 'user', content: prompt }];

  try {
    const response = await client.chat(messages, {
      signal: AbortSignal.timeout(timeoutMs),
      retryDelays: [1000],
    });
    const cleanedText = response.content.trim();
    if (!cleanedText) {
      // Empty content is treated as a failure (per prd Decisions): fall back to the
      // original field value with the Fail prefix and surface a warning.
      log(`[ai-aggregation] cleanResult failed: ${AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE}`);
      return {
        result: applyFailPrefix(result, hasContent),
        warning: buildFailureWarning(AI_AGGREGATION_EMPTY_RESPONSE_MESSAGE),
      };
    }

    return { result: applySuccessPrefix(result, hasContent, cleanedText) };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    log(`[ai-aggregation] cleanResult failed: ${rawMessage}`);
    return {
      result: applyFailPrefix(result, hasContent),
      warning: buildFailureWarning(rawMessage),
    };
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
  const accumulatedWarnings: SearchWarning[] = [];

  for (const result of response.results) {
    const outcome = await cleanResult(
      resolvedClient,
      request.query,
      result,
      request.hasContent,
      timeoutMs,
    );
    cleanedResults.push(outcome.result);
    if (outcome.warning) {
      accumulatedWarnings.push(outcome.warning);
    }
  }

  return {
    ...response,
    results: cleanedResults,
    warnings: [...response.warnings, ...accumulatedWarnings],
  };
}
