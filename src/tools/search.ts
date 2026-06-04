import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { aggregateSearch } from '../aggregator/search.js';
import type { Config } from '../config/types.js';
import { buildRegistry, getSearchProviders } from '../providers/registry.js';
import { SearchInputSchema } from './schemas.js';

export function registerSearchTool(server: McpServer, config: Config): void {
  const allProviders = getSearchProviders(config);
  const registry = buildRegistry(config);

  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Search the web across multiple providers with aggregated, deduplicated results.',
      inputSchema: SearchInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const params = SearchInputSchema.parse(input);

      // Determine channels
      let channelIds: string[];
      if (params.channels && params.channels.length > 0) {
        channelIds = params.channels;
      } else if (params.mode === 'high') {
        // high falls back to default channels; AI synthesis stub
        channelIds = registry.defaultSearchChannels;
      } else {
        channelIds = registry.defaultSearchChannels;
      }

      const providers = allProviders.filter((p) => channelIds.includes(p.id));

      if (providers.length === 0) {
        const msg = `No configured providers available for channels: ${channelIds.join(', ')}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }

      const warnings: { provider: string; code: string; message: string }[] = [];
      if (params.mode === 'high' && !config.ai?.apiKey) {
        warnings.push({
          provider: 'system',
          code: 'HIGH_MODE_DEGRADED',
          message: 'AI key not configured; degraded to default mode.',
        });
      }

      try {
        const response = await aggregateSearch(
          {
            query: params.query,
            mode: params.mode,
            channels: params.channels,
            hasContent: params.hasContent,
            numResults: params.numResults,
            includeDomains: params.includeDomains,
            excludeDomains: params.excludeDomains,
            startDate: params.startDate,
            endDate: params.endDate,
            topic: params.topic,
            searchDepth: params.searchDepth,
            includeImages: params.includeImages,
            timeoutMs: params.timeoutMs,
          },
          providers,
        );

        const mergedWarnings = [...warnings, ...response.warnings];

        // EC-1: surface ALL_PROVIDERS_FAILED as a structured error result.
        if (response.error) {
          const errorResult = {
            error: response.error,
            warnings: mergedWarnings,
          };
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(errorResult) }],
            structuredContent: errorResult,
            isError: true,
          };
        }

        const result = {
          results: response.results,
          warnings: mergedWarnings,
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
