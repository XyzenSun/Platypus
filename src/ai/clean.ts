const DEFAULT_PROMPT =
  '去除与搜索词无关的导航、广告及重复内容，保留有用事实与来源链接。只返回清洗后的纯文本，不添加解释。';

type GetConfig = (name: string) => string | undefined;
const DEFAULT_AI_TIMEOUT_SECONDS = 120;
const MAX_TIMEOUT_MILLISECONDS = 2_147_483_647;

function resolveAITimeout(cliTimeout: string | undefined, getConfig: GetConfig): number {
  const setting = cliTimeout ?? getConfig('PLATYPUS_AI_TIMEOUT');
  const seconds = setting === undefined ? DEFAULT_AI_TIMEOUT_SECONDS : Number(setting);
  if (
    (setting !== undefined && !/^\d+$/u.test(setting)) ||
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds * 1000 > MAX_TIMEOUT_MILLISECONDS
  ) {
    throw new Error('AI 超时必须为正整数秒且不超过计时器上限 (--ai-timeout / PLATYPUS_AI_TIMEOUT)');
  }
  return seconds * 1000;
}

async function callWithAITimeout(
  timeoutMilliseconds: number,
  call: (signal: AbortSignal) => Promise<string | undefined>,
): Promise<string | undefined> {
  const controller = new AbortController();
  // 只对单次 AI 清洗调用设期限，SDK 内部的重试共享该 signal；搜索请求不计入。
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const result = await call(controller.signal);
    if (controller.signal.aborted) throw new Error('AI 调用在超时后返回');
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`AI 清洗超时 (${timeoutMilliseconds / 1000} 秒)`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function cleanResponse(
  query: string,
  rawResponse: string,
  prompt: string | undefined,
  getConfig: GetConfig,
  cliTimeout?: string,
): Promise<string> {
  const format = getConfig('PLATYPUS_AI_FORMAT');
  if (format !== 'openai' && format !== 'anthropic' && format !== 'gemini') {
    throw new Error('PLATYPUS_AI_FORMAT 必须为 openai、anthropic 或 gemini');
  }
  const instruction = prompt ?? DEFAULT_PROMPT;
  const input = `请严格遵循以下清洗要求，只返回处理后的纯文本，不添加解释:\n${instruction}\n\n搜索词: ${query}\n上游响应:\n${rawResponse}`;
  const streamEnabled = getConfig('PLATYPUS_AI_STREAMBLE') === 'true';
  const timeoutMilliseconds = resolveAITimeout(cliTimeout, getConfig);
  let text: string | undefined;
  switch (format) {
    case 'openai': {
      const { cleanWithOpenAI } = await import('./client/openai.js');
      text = await callWithAITimeout(timeoutMilliseconds, (signal) =>
        cleanWithOpenAI(instruction, input, getConfig, streamEnabled, signal),
      );
      break;
    }
    case 'anthropic': {
      const { cleanWithAnthropic } = await import('./client/anthropic.js');
      text = await callWithAITimeout(timeoutMilliseconds, (signal) =>
        cleanWithAnthropic(instruction, input, getConfig, streamEnabled, signal),
      );
      break;
    }
    case 'gemini': {
      const { cleanWithGemini } = await import('./client/gemini.js');
      text = await callWithAITimeout(timeoutMilliseconds, (signal) =>
        cleanWithGemini(instruction, input, getConfig, signal),
      );
      break;
    }
  }
  if (!text?.trim()) throw new Error('AI 返回空内容');
  return text.trim();
}
