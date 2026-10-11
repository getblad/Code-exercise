import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error';
import type { AuthService } from '../modules/auth/auth.service';
import type { Principal } from '../modules/auth/principal';

const BEARER_TOKEN = /^Bearer\s+(\S+)$/i;

export function createRequireAuth(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const token = BEARER_TOKEN.exec(req.headers.authorization ?? '')?.[1];
    if (token === undefined) throw new UnauthorizedError('Missing bearer token');

    req.principal = await auth.authenticate(token);
    next();
  };
}

export function getPrincipal(req: Request): Principal {
  if (!req.principal) throw new UnauthorizedError('Missing bearer token');
  return req.principal;
}
