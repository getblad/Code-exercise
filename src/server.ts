import { createApp } from './app';
import { loadEnv } from './config/env';
import { closeHttpServer, startHttpServer } from './infrastructure/http-server';
import { createLifecycle } from './infrastructure/lifecycle';
import { createLogger } from './infrastructure/logger';
import { connectMongo, disconnectMongo, ensureIndexes, pingMongo } from './infrastructure/mongo';
import { BookModel } from './modules/books/book.model';
import { LibraryModel } from './modules/libraries/library.model';
import { UserModel } from './modules/users/user.model';
import { seedDatabase } from './seed/seed';

async function start(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const lifecycle = createLifecycle(logger);

  try {
    await connectMongo(env.MONGO_URI, logger);
    lifecycle.onShutdown(disconnectMongo);
    await ensureIndexes([LibraryModel, UserModel, BookModel]);
    if (env.SEED_ON_STARTUP) await seedDatabase(logger);

    const app = createApp({ logger, checkDatabase: pingMongo });
    const server = await startHttpServer(app, env.PORT);
    lifecycle.onShutdown(() => closeHttpServer(server));
    logger.info({ port: env.PORT }, 'Server listening');
  } catch (err) {
    logger.fatal({ err }, 'Startup failed');
    await lifecycle.shutdown('startup failure', 1);
  }
}

start().catch((err: unknown) => {
  createLogger('info').fatal({ err }, 'Startup failed');
  process.exitCode = 1;
});
