import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/env.js';
import { logger } from './server/logger.js';
import { createServer } from './server/server.js';

const config = await loadConfig();
const server = createServer(config);
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info('ready on stdio');
