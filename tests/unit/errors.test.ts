import { describe, expect, it } from 'vitest';
import { ProviderError, classifyError, classifyHttpStatus } from '../../src/lib/errors.js';

describe('classifyHttpStatus', () => {
  it('401 → QUOTA', () => expect(classifyHttpStatus(401)).toBe('QUOTA'));
  it('402 → QUOTA', () => expect(classifyHttpStatus(402)).toBe('QUOTA'));
  it('403 → QUOTA', () => expect(classifyHttpStatus(403)).toBe('QUOTA'));
  it('432 → QUOTA', () => expect(classifyHttpStatus(432)).toBe('QUOTA'));
  it('433 → QUOTA', () => expect(classifyHttpStatus(433)).toBe('QUOTA'));
  it('429 → NETWORK', () => expect(classifyHttpStatus(429)).toBe('NETWORK'));
  it('408 → NETWORK', () => expect(classifyHttpStatus(408)).toBe('NETWORK'));
  it('500 → NETWORK', () => expect(classifyHttpStatus(500)).toBe('NETWORK'));
  it('503 → NETWORK', () => expect(classifyHttpStatus(503)).toBe('NETWORK'));
  it('400 → USER_ERROR', () => expect(classifyHttpStatus(400)).toBe('USER_ERROR'));
  it('422 → USER_ERROR', () => expect(classifyHttpStatus(422)).toBe('USER_ERROR'));
});

describe('classifyError', () => {
  it('ProviderError returns own category', () => {
    const err = new ProviderError('tavily', 'QUOTA', '401', 'unauth');
    expect(classifyError(err)).toBe('QUOTA');
  });

  it('AbortError → NETWORK', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(classifyError(err)).toBe('NETWORK');
  });

  it('ECONNRESET → NETWORK', () => {
    expect(classifyError(new Error('ECONNRESET'))).toBe('NETWORK');
  });

  it('fetch failed → NETWORK', () => {
    expect(classifyError(new Error('fetch failed'))).toBe('NETWORK');
  });

  it('unknown error → NETWORK', () => {
    expect(classifyError(new Error('something random'))).toBe('NETWORK');
  });
});
