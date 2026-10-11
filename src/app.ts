import express, { type Express } from 'express';
import helmet from 'helmet';
import { createHealthRouter } from './modules/health/health.router';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(createHealthRouter());

  return app;
}
