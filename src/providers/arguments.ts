export function parseOptions(args: string[], queryKey = 'query'): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument?.startsWith('--') || argument === '--') throw new Error(`无效参数: ${argument}`);
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if (!name || name === 'help' || (queryKey === 'q' && name === 'q')) {
      throw new Error(`无效参数: ${argument}`);
    }
    const key = name === 'query' ? queryKey : name;
    if (key in options) throw new Error(`重复参数: --${name}`);
    if (equals !== -1) {
      const value = argument.slice(equals + 1);
      options[key] = name === 'query' ? value : parseValue(value);
    } else if (args[index + 1] && !args[index + 1]?.startsWith('--')) {
      const value = args[++index] ?? '';
      options[key] = name === 'query' ? value : parseValue(value);
    } else if (name === 'query') {
      throw new Error('缺少搜索词: --query <文本>');
    } else {
      options[key] = true;
    }
  }
  if (typeof options[queryKey] !== 'string' || !(options[queryKey] as string).trim()) {
    throw new Error('缺少搜索词: --query <文本>');
  }
  return options;
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return Number(value);
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`无效 JSON 参数: ${value}`);
    }
  }
  return value;
}

export function getQuery(options: Record<string, unknown>, key = 'query'): string {
  return options[key] as string;
}

export function requireKey(getConfig: (name: string) => string | undefined, name: string): string {
  const key = getConfig(name);
  if (!key) throw new Error(`缺少配置: ${name}`);
  return key;
}
