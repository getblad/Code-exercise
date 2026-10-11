import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '../../validation/schemas';

const EARLIEST_TIMEZONE_OFFSET_MS = 14 * 60 * 60 * 1000;

const text = z.string().trim().min(1).max(200);

// UTC+14 reaches a new day first, so its calendar date is the latest "today" anywhere on Earth
const latestToday = (): string =>
  new Date(Date.now() + EARLIEST_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);

export const bookInputSchema = z.strictObject({
  title: text,
  author: text,
  authorCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 country code')
    .nullable()
    .default(null),
  publishedDate: z.iso
    .date()
    .refine((date) => date <= latestToday(), 'must not be in the future')
    .transform((date) => new Date(`${date}T00:00:00.000Z`)),
  pages: z.number().int().min(1).max(100_000),
  libraryId: objectIdSchema,
});

export const bookIdParamsSchema = z.object({ id: objectIdSchema });

export const listBooksQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdSchema.optional(),
});

export const bookCursorSchema = z.strictObject({ afterId: objectIdSchema });

export type BookInput = z.output<typeof bookInputSchema>;
