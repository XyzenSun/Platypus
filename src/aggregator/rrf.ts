import { normalizeUrl } from '../lib/url.js';
import type { RawProviderResult, SearchResult } from '../providers/search-types.js';

const K = 60;

export function rrfMerge(providerResults: Map<string, RawProviderResult[]>): SearchResult[] {
  // Map from canonical URL → merged data
  const merged = new Map<
    string,
    {
      url: string;
      title: string;
      snippet: string;
      content?: string;
      publishedDate?: string;
      sources: string[];
      rrfScore: number;
    }
  >();

  for (const [provider, results] of providerResults) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      const canonical = normalizeUrl(r.url);
      const contribution = 1 / (K + (i + 1));

      const existing = merged.get(canonical);
      if (existing) {
        existing.rrfScore += contribution;
        existing.sources.push(provider);
        // keep longest title/snippet
        if (r.title.length > existing.title.length) existing.title = r.title;
        if (r.snippet.length > existing.snippet.length) existing.snippet = r.snippet;
        if (!existing.content && r.content) existing.content = r.content;
        if (!existing.publishedDate && r.publishedDate) existing.publishedDate = r.publishedDate;
      } else {
        merged.set(canonical, {
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          content: r.content,
          publishedDate: r.publishedDate,
          sources: [provider],
          rrfScore: contribution,
        });
      }
    }
  }

  const sorted = [...merged.entries()].sort((a, b) => b[1].rrfScore - a[1].rrfScore);

  return sorted.map(([canonical, data], idx) => ({
    id: canonical,
    url: data.url,
    title: data.title,
    snippet: data.snippet,
    content: data.content,
    publishedDate: data.publishedDate,
    score: data.rrfScore,
    rank: idx + 1,
    sources: data.sources,
  }));
}
