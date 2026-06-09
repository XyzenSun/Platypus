export const logger = {
  info: (msg: string) => process.stderr.write(`[justsearch] INFO: ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[justsearch] ERROR: ${msg}\n`),
};

/**
 * Low-level stderr log used by aggregator/provider code. MCP servers communicate
 * over stdout, so logs must go to stderr — never use console.log/error.
 */
export function log(msg: string): void {
  process.stderr.write(`[justsearch] ${msg}\n`);
}
