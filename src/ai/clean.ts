const DEFAULT_PROMPT =
  '去除与搜索词无关的导航、广告及重复内容，保留有用事实与来源链接。只返回清洗后的纯文本，不添加解释。';

type GetConfig = (name: string) => string | undefined;

export async function cleanResponse(
  query: string,
  rawResponse: string,
  prompt: string | undefined,
  getConfig: GetConfig,
): Promise<string> {
  const format = getConfig('PLATYPUS_AI_FORMAT');
  if (format !== 'openai' && format !== 'anthropic' && format !== 'gemini') {
    throw new Error('PLATYPUS_AI_FORMAT 必须为 openai、anthropic 或 gemini');
  }
  const instruction = prompt ?? DEFAULT_PROMPT;
  const input = `请严格遵循以下清洗要求，只返回处理后的纯文本，不添加解释:\n${instruction}\n\n搜索词: ${query}\n上游响应:\n${rawResponse}`;
  const streamEnabled = getConfig('PLATYPUS_AI_STREAMBLE') === 'true';
  let text: string | undefined;
  switch (format) {
    case 'openai': {
      const { cleanWithOpenAI } = await import('./client/openai.js');
      text = await cleanWithOpenAI(instruction, input, getConfig, streamEnabled);
      break;
    }
    case 'anthropic': {
      const { cleanWithAnthropic } = await import('./client/anthropic.js');
      text = await cleanWithAnthropic(instruction, input, getConfig, streamEnabled);
      break;
    }
    case 'gemini': {
      const { cleanWithGemini } = await import('./client/gemini.js');
      text = await cleanWithGemini(instruction, input, getConfig);
      break;
    }
  }
  if (!text?.trim()) throw new Error('AI 返回空内容');
  return text.trim();
}
