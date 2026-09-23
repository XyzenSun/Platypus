export async function requestJson(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  const rawResponse = await response.text();
  if (response.status !== 200) {
    throw new Error(`上游 HTTP ${response.status}: ${rawResponse}`);
  }
  return rawResponse;
}

export function endpoint(baseUrl: string | undefined, fallback: string): string {
  return `${(baseUrl ?? fallback).replace(/\/+$/u, '')}/search`;
}
