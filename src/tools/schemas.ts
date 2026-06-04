import { z } from 'zod';

export const ListInputSchema = z.object({});

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(400).describe('Search query'),
});

export const FetchInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).describe('URLs to fetch'),
});
