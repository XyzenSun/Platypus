import type { ProviderRanked } from './scoring-types.js';
import { RrfScoringStrategy } from './strategies/rrf.js';

export { RrfScoringStrategy } from './strategies/rrf.js';

const defaultRrf = new RrfScoringStrategy();

/**
 * Backward-compatible default export. Equivalent to `new RrfScoringStrategy().merge(input)`.
 * For a custom k or a different scoring algorithm, instantiate the strategy class directly
 * and pass it to `aggregateSearch`.
 */
export const rrfMerge = (input: ProviderRanked) => defaultRrf.merge(input);
