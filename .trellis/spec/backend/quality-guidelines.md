# Quality Guidelines

## TypeScript

- `strict: true` and `noUncheckedIndexedAccess: true` are enforced — no `any`, no unsafe index access without a null check.
- Use `import type` for type-only imports.
- All imports require `.js` extension (NodeNext resolution).

## Linting & Formatting

Toolchain: **Biome** (`biome.json`). Run before committing:

```bash
npm run lint        # biome check .
npm run typecheck   # tsc --noEmit
```

Formatting rules: 2-space indent, line width 100, single quotes, trailing commas.

## Testing

- **Unit tests**: `tests/unit/` — run with `npm run test` (vitest). Cover pure logic: scoring strategies, URL normalization, error classification, retry, registry.
- **E2E tests**: `tests/e2e/` — require real API keys. Run with `npm run test:e2e`. Not required for every change.
- New aggregator strategies and lib utilities must have unit tests.
- Provider adapter changes should be covered by E2E tests when possible.

## Required Patterns

- External HTTP calls: always wrap in `withRetry`, always use `AbortSignal.timeout(params.timeoutMs)`.
- Provider failures: always throw `ProviderError` with correct category.
- MCP tool inputs: always validate with a Zod schema in `src/tools/schemas.ts`.

## Forbidden Patterns

- No `console.log` — use `log()` from `src/server/logger.ts` which writes to stderr.
- No `any` type.
- No direct `process.env` access outside `src/config/env.ts`.
- No provider-specific logic in the aggregator layer — keep adapters self-contained.
