export interface ProviderResponse {
  rawResponse: string;
  query: string;
}

export interface SearchProvider {
  run(
    args: string[],
    getConfig: (name: string) => string | undefined,
    signal: AbortSignal,
  ): Promise<ProviderResponse>;
  help: string;
}
