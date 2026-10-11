import mongoose from 'mongoose';
import type { Logger } from 'pino';
import { loadDotEnv, mongoUriSchema } from '../config/env';
import { createLogger } from '../infrastructure/logger';

export function runMongoScript(name: string, task: (logger: Logger) => Promise<void>): void {
  const logger = createLogger('info');

  const run = async (): Promise<void> => {
    loadDotEnv();
    await mongoose.connect(mongoUriSchema.parse(process.env.MONGO_URI));
    try {
      await task(logger);
    } finally {
      await mongoose.disconnect();
    }
  };

  run().catch((err: unknown) => {
    logger.fatal({ err, script: name }, 'Script failed');
    process.exitCode = 1;
  });
}
