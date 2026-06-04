import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../../src/lib/url.js';

describe('normalizeUrl', () => {
  it('forces https', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('https://example.com/page');
  });

  it('strips www', () => {
    expect(normalizeUrl('https://www.example.com/page')).toBe('https://example.com/page');
  });

  it('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('keeps root slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('strips fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('strips utm_source', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=google')).toBe(
      'https://example.com/page',
    );
  });

  it('strips utm_* wildcard', () => {
    expect(normalizeUrl('https://example.com/?utm_campaign=x&utm_medium=y')).toBe(
      'https://example.com/',
    );
  });

  it('strips fbclid', () => {
    expect(normalizeUrl('https://example.com/p?fbclid=abc')).toBe('https://example.com/p');
  });

  it('strips gclid', () => {
    expect(normalizeUrl('https://example.com/p?gclid=abc')).toBe('https://example.com/p');
  });

  it('strips ref param', () => {
    expect(normalizeUrl('https://example.com/p?ref=homepage')).toBe('https://example.com/p');
  });

  it('preserves non-tracking query params', () => {
    expect(normalizeUrl('https://example.com/search?q=hello')).toBe(
      'https://example.com/search?q=hello',
    );
  });

  it('lowercases hostname', () => {
    expect(normalizeUrl('https://Example.COM/page')).toBe('https://example.com/page');
  });

  it('returns raw string on invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});
