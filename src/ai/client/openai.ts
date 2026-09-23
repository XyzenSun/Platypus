import type OpenAI from 'openai';

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

export async function cleanWithOpenAI(
  instruction: string,
  input: string,
  getConfig: GetConfig,
  streamEnabled: boolean,
): Promise<string | undefined> {
  const apiKey = getConfig('PLATYPUS_AI_API_KEY');
  const model = getConfig('PLATYPUS_AI_MODEL');
  if (!apiKey || !model) throw new Error('缺少配置: PLATYPUS_AI_API_KEY 或 PLATYPUS_AI_MODEL');
  const baseURL = getConfig('PLATYPUS_AI_BASE_URL');
  const { default: OpenAIClient } = await import('openai');
  // OpenAI SDK 会在 baseURL 后追加 /chat/completions，此处只规范化到 /v1。
  const client: OpenAI = new OpenAIClient({
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
  return response.choices[0]?.message.content ?? undefined;
}
