type GetConfig = (name: string) => string | undefined;
const DEFAULT_MAX_TOKENS = 8192;

export async function cleanWithAnthropic(
  instruction: string,
  input: string,
  getConfig: GetConfig,
  streamEnabled: boolean,
  signal: AbortSignal,
): Promise<string> {
  const apiKey = getConfig('PLATYPUS_AI_API_KEY');
  const model = getConfig('PLATYPUS_AI_MODEL');
  if (!apiKey || !model) throw new Error('缺少配置: PLATYPUS_AI_API_KEY 或 PLATYPUS_AI_MODEL');
  const baseURL = getConfig('PLATYPUS_AI_BASE_URL');
  const maxTokensSetting = getConfig('PLATYPUS_AI_MAX_TOKENS');
  const maxTokens = maxTokensSetting === undefined ? DEFAULT_MAX_TOKENS : Number(maxTokensSetting);
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
    throw new Error('PLATYPUS_AI_MAX_TOKENS 必须为正整数');
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const request = {
    model,
    max_tokens: maxTokens,
    system: instruction,
    messages: [{ role: 'user' as const, content: input }],
  };
  const response = streamEnabled
    ? await client.messages.stream(request, { signal }).finalMessage()
    : await client.messages.create(request, { signal });
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
