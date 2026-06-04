import type { SearchResult } from '../../providers/search-types.js';
import type { ProviderRanked, ScoringStrategy } from '../scoring-types.js';
import { RrfScoringStrategy } from './rrf.js';

const GEMINI_SOURCE = 'gemini';

/**
 * Wraps RrfScoringStrategy. Recomputes the Gemini-sourced result's score:
 *   - if other providers also produced results: gemini.score = mean(otherScores)
 *   - if only gemini: gemini.score = 0.5
 * Then re-sorts by score and re-assigns rank.
 *
 * Why this matters: a Gemini "AI summary" result has a sentinel URL
 * (gemini://summary) that never collides with another provider's URL, so its
 * raw RRF score of 1/(k+1) sits at the bottom of the list. That makes the
 * single most useful summary-style result invisible. Averaging it with the
 * other providers' scores keeps it in the same "credibility band" as the
 * organic results.
 */
export class GeminiBoostScoringStrategy implements ScoringStrategy {
  readonly id = 'rrf+gemini-boost';

  constructor(private readonly inner: RrfScoringStrategy = new RrfScoringStrategy()) {}

  merge(input: ProviderRanked): SearchResult[] {
    const merged = this.inner.merge(input);
    const geminiIdx = merged.findIndex(
      (r) => r.sources.length === 1 && r.sources[0] === GEMINI_SOURCE,
    );
    if (geminiIdx === -1) return merged;

    const gemini = merged[geminiIdx];
    if (!gemini) return merged;

    const others = merged.filter((_, i) => i !== geminiIdx);
    if (others.length === 0) {
      gemini.score = 0.5;
    } else {
      const sum = others.reduce((s, r) => s + r.score, 0);
      gemini.score = sum / others.length;
    }

    const resorted = [...others, gemini].sort((a, b) => b.score - a.score);
    return resorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }
}
