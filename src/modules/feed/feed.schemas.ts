import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '../../validation/schemas';

export const feedQuerySchema = paginationQuerySchema;

export const feedCursorSchema = z.strictObject({
  phase: z.enum(['same', 'other']),
  score: z.number(),
  id: objectIdSchema,
});
