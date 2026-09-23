import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function saveAIFailure(
  provider: string,
  reason: unknown,
  rawResponse: string,
): Promise<string> {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');
  const path = join('/tmp', `platypus-error-${provider}-${stamp}.json`);
  const error = reason instanceof Error ? reason.message : String(reason);
  await writeFile(path, JSON.stringify({ provider, error, rawResponse }, null, 2), { mode: 0o600 });
  return path;
}
