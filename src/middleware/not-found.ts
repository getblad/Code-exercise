import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError('Route not found');
};
