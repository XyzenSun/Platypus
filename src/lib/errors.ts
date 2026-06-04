export type ErrorCategory = 'NETWORK' | 'QUOTA' | 'USER_ERROR';

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly category: ErrorCategory,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Classify an HTTP status code into an error category.
 * NETWORK = retry-able; QUOTA = billing/auth, no retry; USER_ERROR = bad params, throw immediately.
 */
export function classifyHttpStatus(status: number): ErrorCategory {
  if (status === 401 || status === 402 || status === 403 || status === 432 || status === 433) {
    return 'QUOTA';
  }
  if (status === 429 || status === 408 || status >= 500) {
    return 'NETWORK';
  }
  // other 4xx
  return 'USER_ERROR';
}

/** Classify a caught error (network-level, e.g. fetch TypeError or AbortError). */
export function classifyError(err: unknown): ErrorCategory {
  if (err instanceof ProviderError) return err.category;
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;
    if (
      name === 'AbortError' ||
      name === 'TimeoutError' ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed')
    ) {
      return 'NETWORK';
    }
  }
  return 'NETWORK';
}
