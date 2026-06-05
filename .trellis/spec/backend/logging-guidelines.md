# Logging Guidelines

## Logger

There is one logging utility: `log()` in `src/server/logger.ts`. It writes to **stderr** (required for MCP servers that communicate over stdout).

```typescript
import { log } from '../server/logger.js';
log('message here');
```

Do not use `console.log` anywhere — it writes to stdout and corrupts the MCP protocol stream.

## What to Log

- Provider warnings and degraded states.
- Server startup (which providers are active).
- Unexpected errors in aggregators.

## What NOT to Log

- API keys or credentials.
- Full HTTP request/response bodies (can contain sensitive content).
- Per-result content (too verbose).
