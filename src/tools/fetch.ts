import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FetchInputSchema } from './schemas.js';

export function registerFetchTool(server: McpServer): void {
  server.registerTool(
    'fetch',
    {
      title: 'Fetch',
      description: 'Fetch and extract content from URLs via multiple providers.',
      inputSchema: FetchInputSchema.shape,
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
