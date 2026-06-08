import { z } from 'zod';

export const ListInputSchema = z.object({});

const SearchDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(400).describe('Search query'),
  mode: z.enum(['search']).default('search').describe('Top-level orchestration mode'),
  channels: z.array(z.string()).optional().describe('Override provider channels'),
  hasContent: z.boolean().default(true).describe('Include body-like content when available'),
  perChannelMaxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Max results per channel'),
  includeDomains: z.string().optional().describe('Comma-separated domain whitelist'),
  excludeDomains: z.string().optional().describe('Comma-separated domain blacklist'),
  publishedAfter: SearchDateSchema.optional().describe('Published after date YYYY-MM-DD'),
  publishedBefore: SearchDateSchema.optional().describe('Published before date YYYY-MM-DD'),
  topic: z.enum(['common', 'news', 'finance']).default('common').describe('Search topic'),
  language: z.enum(['zh_cn', 'us_en']).optional().describe('Preferred result language'),
  region: z
    .enum(['US', 'CN', 'GB', 'DE', 'FR', 'JP', 'CA'])
    .optional()
    .describe('Preferred country bias'),
  searchEffort: z
    .enum(['low', 'medium', 'high'])
    .default('medium')
    .describe('Latency vs quality tradeoff'),
  minScore: z
    .number()
    .finite()
    .optional()
    .describe('Keep results with score greater than or equal to this value'),
  maxRank: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Keep results with rank less than or equal to this value'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(60000)
    .describe('Per-provider timeout ms'),
});

export const FetchInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20).describe('URLs to fetch (1-20 per call)'),
  channels: z
    .array(z.string())
    .optional()
    .describe(
      'Override fetch channels (subset of [firecrawl, jina, tavily, exa]). Omit to use the default fetch ordering.',
    ),
  format: z
    .enum(['markdown', 'text'])
    .default('markdown')
    .describe('Output format. Some providers (Exa) always return text regardless.'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(60000)
    .describe('Per-provider per-URL timeout in ms.'),
});
