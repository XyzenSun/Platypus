export interface ProviderResponse {
  rawResponse: string;
  query: string;
}

export interface SearchProvider {
  run(args: string[], getConfig: (name: string) => string | undefined): Promise<ProviderResponse>;
  help: string;
}
