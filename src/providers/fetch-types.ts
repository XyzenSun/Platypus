export interface NormalizedFetchParams {
  urls: string[];
  channels?: string[];
  format: 'markdown' | 'text';
  timeoutMs: number;
}

export interface RawFetchResult {
  url: string;
  title?: string;
  content: string;
  format: 'markdown' | 'text';
  fetchedAt: string;
}

export interface FetchProvider {
  id: string;
  fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult>;
}

export interface FetchWarning {
  provider: string;
  url: string;
  code: string;
  message: string;
}

export interface FetchResponse {
  results: {
    [url: string]: {
      [provider: string]: RawFetchResult;
    };
  };
  warnings: FetchWarning[];
  error?: string;
}
