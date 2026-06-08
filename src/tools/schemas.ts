import { z } from 'zod';

export const ListInputSchema = z.object({});

const SearchDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(400).describe('Search keywords.'),
  mode: z.enum(['search']).default('search').describe('Optional. Keep the default value.'),
  channels: z
    .array(z.string())
    .optional()
    .describe('Optional. Search channels to use. Omit to use the default channels.'),
  hasContent: z
    .boolean()
    .default(true)
    .describe(
      'Return full content when available. If disabled, only URLs and titles are returned. Recommended.',
    ),
  perChannelMaxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum results per channel.'),
  includeDomains: z
    .string()
    .optional()
    .describe('Optional. Only return results from these domains, separated by commas.'),
  excludeDomains: z
    .string()
    .optional()
    .describe('Optional. Exclude results from these domains, separated by commas.'),
  publishedAfter: SearchDateSchema.optional().describe(
    'Optional. Only return results after this date, in YYYY-MM-DD format.',
  ),
  publishedBefore: SearchDateSchema.optional().describe(
    'Optional. Only return results before this date, in YYYY-MM-DD format.',
  ),
  topic: z.enum(['common', 'news', 'finance']).default('common').describe('Search topic.'),
  language: z.enum(['zh_cn', 'us_en']).optional().describe('Optional. Preferred result language.'),
  region: z
    .enum(['US', 'CN', 'GB', 'DE', 'FR', 'JP', 'CA'])
    .optional()
    .describe('Optional. Preferred result region.'),
  searchEffort: z.enum(['low', 'medium', 'high']).default('medium').describe('Search depth.'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(60000)
    .describe('Per-channel timeout in milliseconds.'),
  minScore: z
    .number()
    .finite()
    .optional()
    .describe('Optional. Only return results with score greater than or equal to this value.'),
  maxRank: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Optional. Only return results with rank less than or equal to this value.'),
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
