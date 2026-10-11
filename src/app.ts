import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createRequestLogger } from './middleware/request-logger';
import { createRequireAuth } from './middleware/require-auth';
import { createAuthRouter } from './modules/auth/auth.router';
import type { AuthService } from './modules/auth/auth.service';
import { createBookRouter } from './modules/books/book.router';
import type { BookService } from './modules/books/book.service';
import { createHealthRouter } from './modules/health/health.router';

export interface AppDependencies {
  logger: Logger;
  checkDatabase: () => Promise<void>;
  authService: AuthService;
  bookService: BookService;
}

export function createApp({
  logger,
  checkDatabase,
  authService,
  bookService,
}: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(createRequestLogger(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use(createHealthRouter(checkDatabase));
  app.use(createAuthRouter(authService));

  app.use(createRequireAuth(authService));
  app.use(createBookRouter(bookService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
