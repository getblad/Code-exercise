import type { Logger } from 'pino';

const SHUTDOWN_TIMEOUT_MS = 10_000;

type ShutdownHook = () => Promise<void>;

export interface Lifecycle {
  onShutdown(hook: ShutdownHook): void;
  shutdown(reason: string, exitCode: number): Promise<void>;
}

export function createLifecycle(logger: Logger): Lifecycle {
  const hooks: ShutdownHook[] = [];
  let inProgress: Promise<void> | undefined;

  const runHooks = async (reason: string, exitCode: number): Promise<void> => {
    logger.info({ reason }, 'Shutting down');
    setTimeout(() => {
      logger.error('Graceful shutdown timed out');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    let finalCode = exitCode;
    for (const hook of hooks) {
      try {
        await hook();
      } catch (err) {
        logger.error({ err }, 'Shutdown step failed');
        finalCode = 1;
      }
    }
    logger.info({ exitCode: finalCode }, 'Shutdown complete');
    process.exit(finalCode);
  };

  const shutdown = (reason: string, exitCode: number): Promise<void> => {
    inProgress ??= runHooks(reason, exitCode);
    return inProgress;
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(signal, 0);
    });
  }
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    void shutdown('uncaughtException', 1);
  });

  return {
    onShutdown: (hook) => {
      hooks.unshift(hook);
    },
    shutdown,
  };
}
