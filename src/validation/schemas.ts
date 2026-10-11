import { z } from 'zod';
import { isCountryCode } from './country-codes';

export const objectIdSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-f\d]{24}$/, 'must be a 24-character hex id');

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, 'must be an ISO 3166-1 alpha-2 country code');

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});
