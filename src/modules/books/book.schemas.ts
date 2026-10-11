import { z } from 'zod';
import { objectIdSchema } from '../../validation/schemas';

const text = z.string().trim().min(1).max(200);

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
    .transform((date) => new Date(`${date}T00:00:00.000Z`))
    .refine((date) => date.getTime() <= Date.now(), 'must not be in the future'),
  pages: z.number().int().min(1).max(100_000),
  libraryId: objectIdSchema,
});

export const bookIdParamsSchema = z.object({ id: objectIdSchema });

export const listBooksQuerySchema = z.object({
  libraryId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});

export const bookCursorSchema = z.strictObject({ afterId: objectIdSchema });

export type BookInput = z.output<typeof bookInputSchema>;
