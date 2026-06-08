import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';

export const DEFAULT_DOMAIN_BLACKLIST_URL ='https://raw.githubusercontent.com/XyzenSun/Platypus/refs/heads/master/src/config/domain-blacklist.txt';

function normalizeDomain(domain: string): string | undefined {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed || trimmed.startsWith('#')) return undefined;
  return trimmed.replace(/^\.+|\.+$/g, '');
}

export function parseDomainBlacklist(text: string): Set<string> {
  const domains = new Set<string>();

  for (const line of text.split(/\r?\n/u)) {
    const domain = normalizeDomain(line);
    if (domain) domains.add(domain);
  }

  return domains;
}

export function isDomainBlacklisted(hostname: string, blacklist: ReadonlySet<string>): boolean {
  let candidate = hostname
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
  if (!candidate) return false;

  while (candidate) {
    if (blacklist.has(candidate)) return true;
    const dotIndex = candidate.indexOf('.');
    if (dotIndex === -1) return false;
    candidate = candidate.slice(dotIndex + 1);
  }

  return false;
}

export async function loadDomainBlacklist(
  url: string = DEFAULT_DOMAIN_BLACKLIST_URL,
): Promise<Set<string>> {
  return withRetry(async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new ProviderError(
        'config',
        classifyHttpStatus(response.status),
        'DOMAIN_BLACKLIST_LOAD_FAILED',
        `Failed to load domain blacklist: HTTP ${response.status}`,
      );
    }

    return parseDomainBlacklist(await response.text());
  });
}
