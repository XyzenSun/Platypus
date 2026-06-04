const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ttclid',
  'twclid',
  'yclid',
  'ref',
  'source',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  '_gid',
]);

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  // force https
  url.protocol = 'https:';

  // lowercase host, strip www.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  // strip hash
  url.hash = '';

  // strip trailing slash from path (except root)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  // strip tracking params
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}
