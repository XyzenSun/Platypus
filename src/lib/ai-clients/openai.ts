// TODO: PR6 implement.
// This is a stub to keep the AIClient surface symmetric across providers.
// PR6 (mode=high) will fill in `generateGrounded` (optional — OpenAI doesn't
// natively support web grounding without an attached tool) and `synthesize`.
import type { AIClient, GroundedResult, SynthesizeInput } from './types.js';

export interface OpenAIAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAIAIClient implements AIClient {
  readonly id = 'openai' as const;

  // Stored for PR6 to consume.
  private readonly opts: OpenAIAIClientOptions;

  constructor(opts: OpenAIAIClientOptions) {
    this.opts = opts;
  }

  async generateGrounded(_query: string, _signal?: AbortSignal): Promise<GroundedResult> {
    void this.opts;
    throw new Error('OpenAI generateGrounded not yet implemented (PR6)');
  }

  async synthesize(_input: SynthesizeInput, _signal?: AbortSignal): Promise<string> {
    void this.opts;
    throw new Error('OpenAI synthesize not yet implemented (PR6)');
  }
}
