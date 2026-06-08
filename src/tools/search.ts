import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { maybeRunAIAggregation } from '../aggregator/ai-aggregation.js';
import { aggregateSearch, createSearchScoring } from '../aggregator/search.js';
import type { Config } from '../config/types.js';
import { buildRegistry, getSearchProviders } from '../providers/registry.js';
import type { SearchRequest } from '../providers/search-types.js';
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
      const channelIds =
        params.channels && params.channels.length > 0 ? params.channels : registry.search;
      const providers = allProviders.filter((p) => channelIds.includes(p.id));

      if (providers.length === 0) {
        const msg = `No configured providers available for channels: ${channelIds.join(', ')}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          structuredContent: { error: msg },
          isError: true,
        };
      }

      const request: SearchRequest = {
        query: params.query,
        mode: params.mode,
        channels: params.channels,
        timeoutMs: params.timeoutMs,
        hasContent: params.hasContent,
        perChannelMaxResults: params.perChannelMaxResults,
        includeDomains: params.includeDomains,
        excludeDomains: params.excludeDomains,
        publishedAfter: params.publishedAfter,
        publishedBefore: params.publishedBefore,
        topic: params.topic,
        language: params.language,
        region: params.region,
        searchEffort: params.searchEffort,
        minScore: params.minScore,
        maxRank: params.maxRank,
      };

      try {
        const scoring = createSearchScoring(config, request);
        const aggregated = await aggregateSearch(request, providers, scoring);
        const response =
          request.mode === 'AIAggregation'
            ? await maybeRunAIAggregation(config, request, aggregated)
            : aggregated;

        if (response.error) {
          const errorResult = {
            error: response.error,
            warnings: response.warnings,
          };
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(errorResult) }],
            structuredContent: errorResult,
            isError: true,
          };
        }

        const result = {
          results: response.results,
          warnings: response.warnings,
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
