// TODO: PR6 implement.
// This is a stub to keep the AIClient surface symmetric across providers.
// PR6 (mode=high) will fill in `synthesize`. Anthropic doesn't natively support
// web-grounded search, so `generateGrounded` will likely remain unimplemented.
import type { AIClient, GroundedResult, SynthesizeInput } from './types.js';

export interface AnthropicAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class AnthropicAIClient implements AIClient {
  readonly id = 'anthropic' as const;

  // Stored for PR6 to consume.
  private readonly opts: AnthropicAIClientOptions;

  constructor(opts: AnthropicAIClientOptions) {
    this.opts = opts;
  }

  async generateGrounded(_query: string, _signal?: AbortSignal): Promise<GroundedResult> {
    void this.opts;
    throw new Error('Anthropic generateGrounded not yet implemented (PR6)');
  }

  async synthesize(_input: SynthesizeInput, _signal?: AbortSignal): Promise<string> {
    void this.opts;
    throw new Error('Anthropic synthesize not yet implemented (PR6)');
  }
}
