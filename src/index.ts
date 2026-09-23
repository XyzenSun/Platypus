import { cleanResponse } from './ai/clean.js';
import { saveAIFailure } from './ai/failure.js';
import { loadConfig } from './config.js';
import { brave } from './providers/brave.js';
import { exa } from './providers/exa.js';
import { gemini } from './providers/gemini.js';
import { jina } from './providers/jina.js';
import { ollama } from './providers/ollama.js';
import { searxng } from './providers/searxng.js';
import { tavily } from './providers/tavily.js';
import type { SearchProvider } from './providers/types.js';

const providers: Record<string, SearchProvider> = {
  brave,
  exa,
  gemini,
  jina,
  ollama,
  searxng,
  tavily,
};
const requiredProviderConfig: Record<keyof typeof providers, string> = {
  brave: 'PLATYPUS_BRAVE_API_KEY',
  exa: 'PLATYPUS_EXA_API_KEY',
  gemini: 'PLATYPUS_GEMINI_API_KEY',
  jina: 'PLATYPUS_JINA_API_KEY',
  ollama: 'PLATYPUS_OLLAMA_API_KEY',
  searxng: 'PLATYPUS_SEARXNG_BASE_URL',
  tavily: 'PLATYPUS_TAVILY_API_KEY',
};
const help = `用法: platypus [--env <路径>] [--ai] [--prompt <文本>] [--ai-timeout <秒>] [--provider-timeout <秒>] search <provider> [provider 参数]\n       platypus [--env <路径>] list\nProvider: ${Object.keys(providers).join(', ')}\nlist 仅列出已配置 Provider，不检查上游连通性。\n查询选项: platypus search <provider> --help`;

interface WrapperOptions {
  ai: boolean;
  prompt?: string;
  aiTimeout?: string;
  providerTimeout?: string;
  envPath?: string;
  list: boolean;
  provider?: string;
  providerArgs: string[];
}

function parseWrapper(args: string[]): WrapperOptions {
  let ai = false;
  let prompt: string | undefined;
  let aiTimeout: string | undefined;
  let providerTimeout: string | undefined;
  let envPath: string | undefined;
  let index = 0;
  while (index < args.length && args[index] !== 'search' && args[index] !== 'list') {
    const option = args[index++];
    if (option === '--help' && index === args.length) return { ai, list: false, providerArgs: [] };
    if (option === '--ai') {
      ai = true;
    } else if (
      option === '--prompt' ||
      option === '--env' ||
      option === '--ai-timeout' ||
      option === '--provider-timeout'
    ) {
      const value = args[index++];
      if (!value || value.startsWith('--')) throw new Error(`缺少选项值: ${option}`);
      if (option === '--prompt') prompt = value;
      else if (option === '--ai-timeout') aiTimeout = value;
      else if (option === '--provider-timeout') providerTimeout = value;
      else envPath = value;
    } else {
      throw new Error(`未知包装器选项: ${option}`);
    }
  }
  if (args[index] === 'list') {
    if (
      args.length !== index + 1 ||
      ai ||
      prompt !== undefined ||
      aiTimeout !== undefined ||
      providerTimeout !== undefined
    ) {
      throw new Error('list 仅支持 --env <路径>');
    }
    return { ai: false, list: true, envPath, providerArgs: [] };
  }
  if (args[index] !== 'search') throw new Error(help);
  const provider = args[index + 1];
  if (!provider) throw new Error('缺少 Provider 名称');
  if (prompt !== undefined && !ai) throw new Error('--prompt 需要同时启用 --ai');
  if (aiTimeout !== undefined && !ai) throw new Error('--ai-timeout 需要同时启用 --ai');
  return {
    ai,
    list: false,
    prompt,
    aiTimeout,
    providerTimeout,
    envPath,
    provider,
    providerArgs: args.slice(index + 2),
  };
}

async function main(): Promise<void> {
  const options = parseWrapper(process.argv.slice(2));
  if (options.list) {
    const getConfig = await loadConfig(options.envPath);
    const configuredProviders = Object.keys(providers).filter((provider) => {
      const variable = requiredProviderConfig[provider];
      return variable !== undefined && Boolean(getConfig(variable)?.trim());
    });
    process.stdout.write(`${JSON.stringify(configuredProviders)}\n`);
    return;
  }
  if (!options.provider) {
    process.stdout.write(`${help}\n`);
    return;
  }
  const adapter = providers[options.provider];
  if (!adapter) throw new Error(`未知 Provider: ${options.provider}`);
  if (options.providerArgs.length === 1 && options.providerArgs[0] === '--help') {
    process.stdout.write(`${adapter.help}\n`);
    return;
  }
  const getConfig = await loadConfig(options.envPath);
  const providerTimeoutSeconds = options.providerTimeout ?? '30';
  if (
    !/^\d+$/u.test(providerTimeoutSeconds) ||
    !Number.isSafeInteger(Number(providerTimeoutSeconds)) ||
    Number(providerTimeoutSeconds) < 1 ||
    Number(providerTimeoutSeconds) * 1000 > 2_147_483_647
  ) {
    throw new Error('--provider-timeout 必须为正整数秒且不超过计时器上限');
  }
  const timeoutMilliseconds = Number(providerTimeoutSeconds) * 1000;
  const controller = new AbortController();
  // 单次搜索使用同一个取消信号，超时后中止上游请求与响应读取，不影响后续 AI 清洗。
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  let result: Awaited<ReturnType<typeof adapter.run>>;
  try {
    result = await adapter.run(options.providerArgs, getConfig, controller.signal);
    if (controller.signal.aborted) throw new Error('上游调用在超时后返回');
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`上游调用超时 (${providerTimeoutSeconds} 秒)`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const { query, rawResponse } = result;
  if (!options.ai) {
    process.stdout.write(rawResponse);
    return;
  }
  try {
    const text = await cleanResponse(
      query,
      rawResponse,
      options.prompt,
      getConfig,
      options.aiTimeout,
    );
    process.stdout.write(`${text}\n`);
  } catch (error) {
    const path = await saveAIFailure(options.provider, error, rawResponse);
    process.stdout.write(`AI处理失败，原始响应与AI错误原因见${path}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
