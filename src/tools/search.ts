import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SearchInputSchema } from './schemas.js';

export function registerSearchTool(server: McpServer): void {
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
    async () => {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'not implemented in PR1' }) }],
        structuredContent: { error: 'not implemented in PR1' },
      };
    },
  );
}
