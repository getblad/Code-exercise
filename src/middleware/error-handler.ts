import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError, type FieldError } from '../errors/app-error';

interface Problem {
  status: number;
  detail?: string | undefined;
  errors?: FieldError[] | undefined;
}

interface ProblemDetails extends Problem {
  type: 'about:blank';
  title: string;
  instance: string;
  requestId?: string | undefined;
}

interface ClientHttpError {
  status: number;
  type?: unknown;
}

const DUPLICATE_KEY_CODE = 11000;

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const known = toKnownProblem(err);
  if (known === undefined) {
    // pino-http logs res.err, stack included, on this request's completion line
    res.err = err instanceof Error ? err : new Error('Non-error value thrown', { cause: err });
  }

  const problem = known ?? { status: 500 };
  const body: ProblemDetails = {
    type: 'about:blank',
    title: STATUS_CODES[problem.status] ?? 'Error',
    status: problem.status,
    detail: problem.detail,
    instance: req.originalUrl,
    requestId: typeof req.id === 'string' ? req.id : undefined,
    errors: problem.errors,
  };
  res.status(problem.status).type('application/problem+json').json(body);
};

function toKnownProblem(err: unknown): Problem | undefined {
  if (err instanceof AppError) {
    return { status: err.status, detail: err.message, errors: err.errors };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(({ path, message }) => ({ path, message }));
    return { status: 400, detail: 'Validation failed', errors };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, detail: `Invalid value for '${err.path}'` };
  }
  if (err instanceof mongoose.mongo.MongoServerError && err.code === DUPLICATE_KEY_CODE) {
    return { status: 409, detail: 'Resource already exists' };
  }
  if (isClientHttpError(err)) {
    const detail =
      err.type === 'entity.parse.failed' ? 'Request body is not valid JSON' : undefined;
    return { status: err.status, detail };
  }
  return undefined;
}

function isClientHttpError(err: unknown): err is ClientHttpError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'expose' in err &&
    err.expose === true &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}
