import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config/types.js';
import { buildRegistry } from '../providers/registry.js';
import { ListInputSchema } from './schemas.js';

export function registerListTool(server: McpServer, config: Config): void {
  server.registerTool(
    'list',
    {
      title: 'List providers',
      description: 'List all configured search and fetch providers with their capabilities.',
      inputSchema: ListInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = buildRegistry(config);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );
}
