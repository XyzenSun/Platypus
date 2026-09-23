import { cleanResponse } from './ai/clean.js';
import { saveAIFailure } from './ai/failure.js';
import { loadConfig } from './config.js';
import { exa } from './providers/exa.js';
import { jina } from './providers/jina.js';
import { tavily } from './providers/tavily.js';
import type { SearchProvider } from './providers/types.js';

const providers: Record<string, SearchProvider> = { exa, tavily, jina };
const help =
  '用法: platypus [--env <路径>] [--ai] [--prompt <文本>] search <provider> [provider 参数]\nProvider: exa, tavily, jina\n查询选项: platypus search <provider> --help';

interface WrapperOptions {
  ai: boolean;
  prompt?: string;
  envPath?: string;
  provider?: string;
  providerArgs: string[];
}

function parseWrapper(args: string[]): WrapperOptions {
  let ai = false;
  let prompt: string | undefined;
  let envPath: string | undefined;
  let index = 0;
  while (index < args.length && args[index] !== 'search') {
    const option = args[index++];
    if (option === '--help' && index === args.length) return { ai, providerArgs: [] };
    if (option === '--ai') {
      ai = true;
    } else if (option === '--prompt' || option === '--env') {
      const value = args[index++];
      if (!value || value.startsWith('--')) throw new Error(`缺少选项值: ${option}`);
      if (option === '--prompt') prompt = value;
      else envPath = value;
    } else {
      throw new Error(`未知包装器选项: ${option}`);
    }
  }
  if (args[index] !== 'search') throw new Error(help);
  const provider = args[index + 1];
  if (!provider) throw new Error('缺少 Provider 名称');
  if (prompt !== undefined && !ai) throw new Error('--prompt 需要同时启用 --ai');
  return { ai, prompt, envPath, provider, providerArgs: args.slice(index + 2) };
}

async function main(): Promise<void> {
  const options = parseWrapper(process.argv.slice(2));
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
  const { query, rawResponse } = await adapter.run(options.providerArgs, getConfig);
  if (!options.ai) {
    process.stdout.write(rawResponse);
    return;
  }
  try {
    const text = await cleanResponse(query, rawResponse, options.prompt, getConfig);
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
