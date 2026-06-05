import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { aggregateFetch } from '../aggregator/fetch.js';
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
        "Fetch and extract content from URLs concurrently across multiple providers (Firecrawl, Jina Reader, Tavily Extract, Exa Contents). Returns a byProvider view so the caller can compare each provider's extraction.",
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

      // EC-2 parallel: zero usable providers after intersection → user-error.
      if (providers.length === 0) {
        const msg = `No configured fetch providers available for channels: ${channelIds.join(', ')}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }

      try {
        const response = await aggregateFetch(
          {
            urls: params.urls,
            channels: params.channels,
            format: params.format,
            timeoutMs: params.timeoutMs,
          },
          providers,
        );

        // Surface explicitly-requested-but-unavailable providers as warnings (only when caller
        // passed `channels` explicitly; default channels silently drop missing keys).
        const extraWarnings =
          params.channels && unavailable.length > 0
            ? params.urls.flatMap((url) =>
                unavailable.map((provider) => ({
                  provider,
                  url,
                  code: 'NOT_CONFIGURED',
                  message: `Provider '${provider}' has no fetch capability or no API key configured`,
                })),
              )
            : [];

        const result = {
          results: response.results,
          warnings: [...extraWarnings, ...response.warnings],
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
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
