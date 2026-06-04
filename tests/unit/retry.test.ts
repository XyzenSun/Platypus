import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../src/lib/errors.js';
import { withRetry } from '../../src/lib/retry.js';

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, []);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on NETWORK error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError('p', 'NETWORK', '500', 'err'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, [0]);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry QUOTA errors', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError('p', 'QUOTA', '401', 'unauth'));
    await expect(withRetry(fn, [0, 0])).rejects.toThrow('unauth');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry USER_ERROR', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError('p', 'USER_ERROR', '400', 'bad'));
    await expect(withRetry(fn, [0, 0])).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all retries and throws last error', async () => {
    const err = new ProviderError('p', 'NETWORK', '503', 'fail');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, [0, 0])).rejects.toThrow('fail');
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
