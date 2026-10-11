import type { Request } from 'express';

export function childLocation(req: Request, childId: string): string {
  const path = new URL(req.originalUrl, 'http://localhost').pathname;
  if (path.endsWith('/')) return childId;
  return `${path.slice(path.lastIndexOf('/') + 1)}/${childId}`;
}
