import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LevelWithSilent, Logger } from 'pino';
import pinoHttp, { type HttpLogger, type ReqId } from 'pino-http';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

export function createRequestLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers[REQUEST_ID_HEADER];
      const id =
        typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    customLogLevel: logLevelFor,
    serializers: {
      req: (req: { id: ReqId; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}

function logLevelFor(req: IncomingMessage, res: ServerResponse, err?: Error): LevelWithSilent {
  if (err !== undefined || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return req.url === '/health' ? 'silent' : 'info';
}
