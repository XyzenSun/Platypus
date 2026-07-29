import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { aggregateFetchBest } from '../aggregator/fetch.js';
import type { Config } from '../config/types.js';
import type { FetchProvider } from '../providers/fetch-types.js';
import { buildRegistry, getFetchProviders } from '../providers/registry.js';
import { DEFAULT_FETCH_PRIORITY } from '../providers/types.js';
import { FetchInputSchema } from './schemas.js';

export function registerFetchTool(server: McpServer, config: Config): void {
  const allProviders = getFetchProviders(config);
  const registry = buildRegistry(config);

  server.registerTool(
    'fetch',
    {
      title: 'Fetch',
      description:
        'Fetch and extract content from a single URL concurrently across multiple providers (Firecrawl, Jina Reader, Tavily Extract, Exa Contents). Returns the single best-quality result with its source provider.',
      inputSchema: FetchInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const params = FetchInputSchema.parse(input);

      // Resolve channel set: explicit channels override defaults; default = prioritized configured fetch providers.
      const channelIds: string[] =
        params.channels && params.channels.length > 0
          ? params.channels
          : [
              ...DEFAULT_FETCH_PRIORITY.filter((id) => registry.fetch.includes(id)),
              ...registry.fetch.filter((id) => !DEFAULT_FETCH_PRIORITY.includes(id)),
            ];

      // Filter to providers that are both configured AND in the requested channel set.
      const providers: FetchProvider[] = allProviders.filter((p) => channelIds.includes(p.id));

      // Track providers requested but unavailable (no API key OR no fetch capability).
      const unavailable = channelIds.filter((id) => !allProviders.some((p) => p.id === id));

      // Zero usable providers after intersection → user-error.
      if (providers.length === 0) {
        const msg = `No configured fetch providers available for channels: ${channelIds.join(', ')}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }

      // Surface explicitly-requested-but-unavailable providers as a user-error
      // (only when caller passed `channels` explicitly).
      if (params.channels && unavailable.length > 0) {
        const msg = `Requested fetch providers not configured: ${unavailable.join(', ')}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }

      try {
        const response = await aggregateFetchBest(
          params.url,
          {
            urls: [params.url],
            channels: params.channels,
            format: params.format,
            timeoutMs: params.timeoutMs,
          },
          providers,
        );

        if (response.best === null) {
          const failureSummary = response.failures
            .map((f) => `${f.provider}(${f.code}: ${f.message})`)
            .join('; ');
          const error = `All fetch providers failed or returned no valid content for ${params.url}.${failureSummary ? ` Failures: ${failureSummary}` : ''}`;
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
            structuredContent: { error },
            isError: true,
          };
        }

        // Success: return only the best result with its provider.
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(response.best) }],
          structuredContent: response.best,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }
    },
  );
}
