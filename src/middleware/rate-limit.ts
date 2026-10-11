import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../errors/app-error';

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_ATTEMPTS_PER_WINDOW = 10;

export function createLoginRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_ATTEMPTS_PER_WINDOW,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError('Too many login attempts, try again later'));
    },
  });
}
