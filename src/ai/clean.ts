import Anthropic from '@anthropic-ai/sdk';
import OpenAIClient from 'openai';

const DEFAULT_PROMPT =
  '去除与搜索词无关的导航、广告及重复内容，保留有用事实与来源链接。只返回清洗后的纯文本，不添加解释。';
const DEFAULT_MAX_TOKENS = 8192;

type GetConfig = (name: string) => string | undefined;

function openAIBaseURL(configuredURL: string): string {
  const url = new URL(configuredURL);
  const segments = url.pathname.split('/').filter(Boolean);
  segments.pop();
  url.pathname = `/${[...segments, 'v1'].join('/')}`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/u, '');
}

export async function cleanResponse(
  query: string,
  rawResponse: string,
  prompt: string | undefined,
  getConfig: GetConfig,
): Promise<string> {
  const format = getConfig('PLATYPUS_AI_FORMAT');
  const apiKey = getConfig('PLATYPUS_AI_API_KEY');
  const model = getConfig('PLATYPUS_AI_MODEL');
  const baseURL = getConfig('PLATYPUS_AI_BASE_URL');
  if (!apiKey || !model) throw new Error('缺少配置: PLATYPUS_AI_API_KEY 或 PLATYPUS_AI_MODEL');
  if (format !== 'openai' && format !== 'anthropic') {
    throw new Error('PLATYPUS_AI_FORMAT 必须为 openai 或 anthropic');
  }
  const instruction = prompt ?? DEFAULT_PROMPT;
  const input = `请严格遵循以下清洗要求，只返回处理后的纯文本，不添加解释:\n${instruction}\n\n搜索词: ${query}\n上游响应:\n${rawResponse}`;
  const streamEnabled = getConfig('PLATYPUS_AI_STREAMBLE') === 'true';
  let text: string | undefined;
  if (format === 'openai') {
    // OpenAI SDK 会在 baseURL 后追加 /chat/completions，此处只规范化到 /v1。
    const client = new OpenAIClient({
      apiKey,
      ...(baseURL ? { baseURL: openAIBaseURL(baseURL) } : {}),
    });
    const request = {
      model,
      messages: [
        { role: 'system' as const, content: instruction },
        { role: 'user' as const, content: input },
      ],
    };
    const response = streamEnabled
      ? await client.chat.completions.stream(request).finalChatCompletion()
      : await client.chat.completions.create(request);
    text = response.choices[0]?.message.content ?? undefined;
  } else {
    const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const maxTokensSetting = getConfig('PLATYPUS_AI_MAX_TOKENS');
    const maxTokens =
      maxTokensSetting === undefined ? DEFAULT_MAX_TOKENS : Number(maxTokensSetting);
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
      throw new Error('PLATYPUS_AI_MAX_TOKENS 必须为正整数');
    }
    const request = {
      model,
      max_tokens: maxTokens,
      system: instruction,
      messages: [{ role: 'user' as const, content: input }],
    };
    const response = streamEnabled
      ? await client.messages.stream(request).finalMessage()
      : await client.messages.create(request);
    text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }
  if (!text?.trim()) throw new Error('AI 返回空内容');
  return text.trim();
}
