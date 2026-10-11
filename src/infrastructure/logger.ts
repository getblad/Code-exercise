import pino, { type LevelWithSilent, type Logger } from 'pino';

export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ['password', '*.password', 'token', '*.token'], censor: '[REDACTED]' },
  });
}
