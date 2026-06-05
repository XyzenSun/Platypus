import { z } from 'zod';

export const ListInputSchema = z.object({});

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(400).describe('Search query'),
  mode: z.enum(['default', 'high']).default('default').describe('Quality preset'),
  channels: z.array(z.string()).optional().describe('Override provider channels'),
  hasContent: z.boolean().default(true).describe('Include full page content per result'),
  perChannelMaxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Max results per channel'),
  includeDomains: z.string().optional().describe('Comma-separated domain whitelist'),
  excludeDomains: z.string().optional().describe('Comma-separated domain blacklist'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Start date YYYY-MM-DD'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('End date YYYY-MM-DD'),
  topic: z
    .enum(['general', 'news', 'finance', 'research', 'github', 'pdf', 'company', 'people'])
    .default('general')
    .describe('Search vertical'),
  searchDepth: z
    .enum(['fast', 'balanced', 'deep'])
    .default('balanced')
    .describe('Latency vs quality'),
  includeImages: z.boolean().default(false).describe('Include image URLs in results'),
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
