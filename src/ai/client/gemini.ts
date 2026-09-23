import type { GoogleGenAI } from '@google/genai';

type GetConfig = (name: string) => string | undefined;
type ConfigPrefix = 'PLATYPUS_GEMINI' | 'PLATYPUS_AI';
const DEFAULT_SEARCH_MODEL = 'gemini-flash-lite-latest';

async function createGeminiClient(
  getConfig: GetConfig,
  configPrefix: ConfigPrefix,
): Promise<GoogleGenAI> {
  const apiKey = getConfig(`${configPrefix}_API_KEY`);
  if (!apiKey) throw new Error(`缺少配置: ${configPrefix}_API_KEY`);
  const baseUrl = getConfig(`${configPrefix}_BASE_URL`);
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}

function requireModel(getConfig: GetConfig, configPrefix: ConfigPrefix): string {
  const model = getConfig(`${configPrefix}_MODEL`);
  if (!model) throw new Error(`缺少配置: ${configPrefix}_MODEL`);
  return model;
}

export async function searchGemini(
  query: string,
  getConfig: GetConfig,
  signal: AbortSignal,
  model?: string,
): Promise<string> {
  const client = await createGeminiClient(getConfig, 'PLATYPUS_GEMINI');
  const response = await client.models.generateContent({
    model: model ?? getConfig('PLATYPUS_GEMINI_MODEL') ?? DEFAULT_SEARCH_MODEL,
    contents: query,
    config: { tools: [{ googleSearch: {} }], abortSignal: signal },
  });
  return JSON.stringify(response);
}

export async function cleanWithGemini(
  instruction: string,
  input: string,
  getConfig: GetConfig,
  signal: AbortSignal,
): Promise<string | undefined> {
  // Google GenAI SDK 没有与其他两家一致的流式最终响应接口，暂用非流式。
  const client = await createGeminiClient(getConfig, 'PLATYPUS_AI');
  const response = await client.models.generateContent({
    model: requireModel(getConfig, 'PLATYPUS_AI'),
    contents: input,
    config: { systemInstruction: instruction, abortSignal: signal },
  });
  return response.text ?? undefined;
}
