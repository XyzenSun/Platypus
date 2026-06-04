export const logger = {
  info: (msg: string) => process.stderr.write(`[justsearch] INFO: ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[justsearch] ERROR: ${msg}\n`),
};
