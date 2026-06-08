import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DOMAIN_BLACKLIST_URL,
  isDomainBlacklisted,
  loadDomainBlacklist,
  parseDomainBlacklist,
} from '../../src/config/domain-blacklist.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('domain blacklist', () => {
  it('parses txt lines while ignoring comments and blanks', () => {
    const blacklist = parseDomainBlacklist(
      '# comment\n\nexample.com\nSub.Example.org\n  trailing.test  \n',
    );

    expect(blacklist).toEqual(new Set(['example.com', 'sub.example.org', 'trailing.test']));
  });

  it('matches parent domains without scanning the full list', () => {
    const blacklist = new Set(['example.com']);

    expect(isDomainBlacklisted('example.com', blacklist)).toBe(true);
    expect(isDomainBlacklisted('api.example.com', blacklist)).toBe(true);
    expect(isDomainBlacklisted('otherexample.com', blacklist)).toBe(false);
  });

  it('loads the blacklist from the default raw url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'example.com\n',
    });
    vi.stubGlobal('fetch', fetchMock);

    const blacklist = await loadDomainBlacklist();

    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_DOMAIN_BLACKLIST_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(blacklist).toEqual(new Set(['example.com']));
  });
});
