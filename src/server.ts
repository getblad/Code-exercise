import { createApp } from './app';
import { loadEnv } from './config/env';
import { closeHttpServer, startHttpServer } from './infrastructure/http-server';
import { createLifecycle } from './infrastructure/lifecycle';
import { createLogger } from './infrastructure/logger';
import { connectMongo, disconnectMongo, ensureIndexes, pingMongo } from './infrastructure/mongo';
import { AuthService } from './modules/auth/auth.service';
import { TokenService } from './modules/auth/token.service';
import { BookModel } from './modules/books/book.model';
import { BookRepository } from './modules/books/book.repository';
import { BookService } from './modules/books/book.service';
import { FeedRepository } from './modules/feed/feed.repository';
import { FeedService } from './modules/feed/feed.service';
import { LibraryModel } from './modules/libraries/library.model';
import { UserModel } from './modules/users/user.model';
import { UserRepository } from './modules/users/user.repository';
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

    const authService = new AuthService(
      new UserRepository(),
      new TokenService(env.JWT_SECRET, env.JWT_TTL_SECONDS),
    );
    const app = createApp({
      logger,
      checkDatabase: pingMongo,
      authService,
      bookService: new BookService(new BookRepository()),
      feedService: new FeedService(new FeedRepository()),
      trustProxyHops: env.TRUST_PROXY_HOPS,
    });
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
