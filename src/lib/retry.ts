import { ProviderError, classifyError } from './errors.js';

const DEFAULT_DELAYS = [1000, 2000, 4000];

export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[] = DEFAULT_DELAYS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const category = err instanceof ProviderError ? err.category : classifyError(err);
      if (category !== 'NETWORK') throw err;
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastError;
}
