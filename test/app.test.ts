import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app';

describe('app', () => {
  it('reports liveness on GET /health', async () => {
    const res = await request(createApp()).get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});
