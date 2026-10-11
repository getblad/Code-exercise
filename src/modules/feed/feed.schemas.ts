import { z } from 'zod';
import { objectIdSchema } from '../../validation/schemas';

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});

export const feedCursorSchema = z.strictObject({
  phase: z.enum(['same', 'other']),
  score: z.number(),
  id: objectIdSchema,
});
