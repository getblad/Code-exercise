import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../errors/app-error';
import { getPrincipal } from './require-auth';

const WINDOW_MS = 60_000;
const LOGIN_ATTEMPTS_PER_WINDOW = 10;
const BOOK_WRITES_PER_WINDOW = 60;

export function createLoginRateLimiter(): RequestHandler {
  return createRateLimiter(LOGIN_ATTEMPTS_PER_WINDOW, 'Too many login attempts, try again later');
}

export function createBookWriteRateLimiter(): RequestHandler {
  return createRateLimiter(
    BOOK_WRITES_PER_WINDOW,
    'Too many book changes, try again later',
    (req) => getPrincipal(req).id,
  );
}

function createRateLimiter(
  limit: number,
  message: string,
  keyGenerator?: (req: Request) => string,
): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    ...(keyGenerator === undefined ? {} : { keyGenerator }),
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError(message));
    },
  });
}
