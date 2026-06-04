import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config/types.js';
import { registerFetchTool } from '../tools/fetch.js';
import { registerListTool } from '../tools/list.js';
import { registerSearchTool } from '../tools/search.js';

export function createServer(config: Config): McpServer {
  const server = new McpServer({ name: 'platypus-mcp', version: '0.0.1' });
  registerListTool(server, config);
  registerSearchTool(server, config);
  registerFetchTool(server);
  return server;
}
