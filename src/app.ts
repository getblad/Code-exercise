import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createRequestLogger } from './middleware/request-logger';
import { createHealthRouter } from './modules/health/health.router';

export interface AppDependencies {
  logger: Logger;
  checkDatabase: () => Promise<void>;
}

export function createApp({ logger, checkDatabase }: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(createRequestLogger(logger));
  app.use(express.json({ limit: '100kb' }));
  app.use(createHealthRouter(checkDatabase));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
