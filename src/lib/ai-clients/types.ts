export interface GroundedResult {
  /** Final LLM-synthesized answer text. */
  answer: string;
  /** Search queries the model issued internally (debugging only — not exposed to MCP caller). */
  searchQueries: string[];
  /** Grounding source list — uri + title — internal use; not exposed to MCP caller per design. */
  chunks: { uri: string; title: string }[];
}

export interface SynthesizeInput {
  query: string;
  /** Pre-fetched search results to ground synthesis on (used by mode=high in PR6). */
  results: { url: string; title: string; snippet: string; content?: string }[];
}

export interface AIClient {
  readonly id: 'gemini' | 'openai' | 'anthropic';
  /** Run a grounded search and return the synthesized answer. */
  generateGrounded(query: string, signal?: AbortSignal): Promise<GroundedResult>;
  /** Synthesize an answer from pre-fetched search results (used by mode=high; PR6 will implement). */
  synthesize(input: SynthesizeInput, signal?: AbortSignal): Promise<string>;
}
