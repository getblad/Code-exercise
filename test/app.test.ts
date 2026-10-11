import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { parseEnv } from '../src/config/env';
import { createLogger } from '../src/infrastructure/logger';
import { errorHandler } from '../src/middleware/error-handler';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function buildApp(checkDatabase: () => Promise<void> = () => Promise.resolve()) {
  return createApp({ logger: createLogger('silent'), checkDatabase });
}

function appFailingWith(error: unknown) {
  const app = express();
  app.get('/boom', (_req, _res, next) => {
    next(error);
  });
  app.use(errorHandler);
  return app;
}

describe('app', () => {
  it('reports healthy and issues a request id when the database answers', async () => {
    const res = await request(buildApp()).get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
    assert.match(res.get('X-Request-Id') ?? '', UUID);
  });

  it('returns 503 problem details when the database is unreachable', async () => {
    const res = await request(buildApp(() => Promise.reject(new Error('connection refused')))).get(
      '/health',
    );

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, {
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Database unavailable',
      instance: '/health',
      requestId: res.get('X-Request-Id'),
    });
  });

  it('answers unknown routes with 404 problem details carrying the caller request id', async () => {
    const res = await request(buildApp()).get('/nope').set('X-Request-Id', 'trace-42');

    assert.equal(res.status, 404);
    assert.match(res.get('Content-Type') ?? '', /^application\/problem\+json/);
    assert.deepEqual(res.body, {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found',
      instance: '/nope',
      requestId: 'trace-42',
    });
  });

  it('rejects a malformed JSON body with 400', async () => {
    const res = await request(buildApp())
      .post('/nope')
      .set('Content-Type', 'application/json')
      .send('{bad');

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Request body is not valid JSON',
      instance: '/nope',
      requestId: res.get('X-Request-Id'),
    });
  });
});

describe('errorHandler', () => {
  const validationError = new mongoose.Error.ValidationError();
  validationError.addError(
    'pages',
    new mongoose.Error.ValidatorError({ path: 'pages', message: 'pages must be positive' }),
  );

  const cases = [
    {
      name: 'hides internal error details behind a generic 500',
      error: new Error('connection string leaked'),
      expected: { status: 500, title: 'Internal Server Error' },
    },
    {
      name: 'maps Mongoose validation errors to 400 with field errors',
      error: validationError,
      expected: {
        status: 400,
        title: 'Bad Request',
        detail: 'Validation failed',
        errors: [{ path: 'pages', message: 'pages must be positive' }],
      },
    },
    {
      name: 'maps an uncastable id to 400 without echoing the value',
      error: new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id'),
      expected: { status: 400, title: 'Bad Request', detail: "Invalid value for '_id'" },
    },
    {
      name: 'maps a duplicate key error to 409',
      error: new mongoose.mongo.MongoServerError({ message: 'E11000 duplicate key', code: 11000 }),
      expected: { status: 409, title: 'Conflict', detail: 'Resource already exists' },
    },
  ];

  for (const { name, error, expected } of cases) {
    it(name, async () => {
      const res = await request(appFailingWith(error)).get('/boom');

      assert.equal(res.status, expected.status);
      assert.deepEqual(res.body, { type: 'about:blank', instance: '/boom', ...expected });
    });
  }
});

describe('parseEnv', () => {
  it('applies defaults to optional variables', () => {
    assert.deepEqual(parseEnv({ MONGO_URI: 'mongodb://localhost:27017/books' }), {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      MONGO_URI: 'mongodb://localhost:27017/books',
    });
  });

  it('names every invalid variable without echoing its value', () => {
    assert.throws(
      () => parseEnv({ PORT: 'not-a-port' }),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes('PORT') &&
        err.message.includes('MONGO_URI') &&
        !err.message.includes('not-a-port'),
    );
  });
});
