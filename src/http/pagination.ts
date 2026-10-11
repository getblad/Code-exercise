import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../errors/app-error';

const invalidCursor = () => new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);

export function encodeCursor(position: object): string {
  return Buffer.from(JSON.stringify(position)).toString('base64url');
}

export function decodeCursor<S extends z.ZodType>(schema: S, cursor: string): z.output<S> {
  let position: unknown;
  try {
    position = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }

  const result = schema.safeParse(position);
  if (!result.success) throw invalidCursor();
  return result.data;
}

export function setNextPageLink(req: Request, res: Response, nextCursor: string | undefined): void {
  if (nextCursor === undefined) return;
  const next = new URL(req.originalUrl, 'http://localhost');
  next.searchParams.set('cursor', nextCursor);
  res.setHeader('Link', `<${next.search}>; rel="next"`);
}
