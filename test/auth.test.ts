import assert from 'node:assert/strict';
import sinon from 'sinon';
import request from 'supertest';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../src/modules/auth/password';
import type { UserCredentials } from '../src/modules/users/user.types';
import { ADMIN, buildTestApp } from './helpers/test-app';

const tokenResponse = z.strictObject({
  token: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.literal(3600),
});
const problemResponse = z.object({
  detail: z.string(),
  errors: z.array(z.object({ path: z.string() })).optional(),
});

describe('password hashing', () => {
  it('verifies the original password and rejects any other', async () => {
    const hash = await hashPassword('password123');

    assert.equal(await verifyPassword('password123', hash), true);
    assert.equal(await verifyPassword('password124', hash), false);
  });

  it('salts every hash and rejects malformed stored values', async () => {
    assert.notEqual(await hashPassword('same'), await hashPassword('same'));
    assert.equal(await verifyPassword('password123', 'not-a-hash'), false);
  });
});

describe('POST /login', () => {
  let adminCredentials: UserCredentials;

  before(async () => {
    adminCredentials = {
      id: ADMIN.id,
      role: 'admin',
      passwordHash: await hashPassword('password123'),
    };
  });

  it('returns a bearer token carrying the user id and role', async () => {
    const { app, users, tokens } = buildTestApp();
    users.findCredentialsByUsername.withArgs('admin').resolves(adminCredentials);

    const res = await request(app)
      .post('/login')
      .send({ username: 'admin', password: 'password123' });

    assert.equal(res.status, 200);
    const { token } = tokenResponse.parse(res.body);
    assert.deepEqual(tokens.verify(token), { userId: ADMIN.id, role: 'admin' });
  });

  it('answers a wrong password and an unknown user with the same 401', async () => {
    const { app, users } = buildTestApp();
    users.findCredentialsByUsername.withArgs('admin').resolves(adminCredentials);
    users.findCredentialsByUsername.withArgs('ghost').resolves(null);

    const responses = [
      await request(app).post('/login').send({ username: 'admin', password: 'wrong-password' }),
      await request(app).post('/login').send({ username: 'ghost', password: 'password123' }),
    ];

    for (const res of responses) {
      assert.equal(res.status, 401);
      assert.equal(res.get('WWW-Authenticate'), 'Bearer');
      assert.deepEqual(res.body, {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid username or password',
        instance: '/login',
        requestId: res.get('X-Request-Id'),
      });
    }
  });

  it('rejects an invalid body with field errors', async () => {
    const res = await request(buildTestApp().app)
      .post('/login')
      .send({ username: '', password: 'x', role: 'admin' });

    assert.equal(res.status, 400);
    const { errors } = problemResponse.parse(res.body);
    assert.deepEqual(
      errors?.map(({ path }) => path),
      ['username', ''],
    );
  });

  it('rate-limits repeated attempts with 429', async () => {
    const { app } = buildTestApp();
    const attempts = Array.from({ length: 10 }, () => request(app).post('/login').send({}));
    await Promise.all(attempts);

    const res = await request(app).post('/login').send({});

    assert.equal(res.status, 429);
  });
});

describe('requireAuth', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('rejects requests without a bearer token', async () => {
    const { app } = buildTestApp();

    for (const header of [undefined, 'Basic YWRtaW46cGFzc3dvcmQxMjM=']) {
      const req = request(app).get('/anything');
      const res = header === undefined ? await req : await req.set('Authorization', header);

      assert.equal(res.status, 401);
      assert.equal(problemResponse.parse(res.body).detail, 'Missing bearer token');
    }
  });

  it('rejects tampered and expired tokens', async () => {
    const { app, authorize } = buildTestApp();
    const header = authorize(ADMIN);

    const tampered = await request(app).get('/anything').set('Authorization', `${header}x`);
    sinon.useFakeTimers({ now: Date.now() + 2 * 3600 * 1000, toFake: ['Date'] });
    const expired = await request(app).get('/anything').set('Authorization', header);

    assert.equal(tampered.status, 401);
    assert.equal(problemResponse.parse(tampered.body).detail, 'Invalid token');
    assert.equal(expired.status, 401);
    assert.equal(problemResponse.parse(expired.body).detail, 'Token expired');
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { app, users, authorize } = buildTestApp();
    const header = authorize(ADMIN);
    users.findProfileById.withArgs(ADMIN.id).resolves(null);

    const res = await request(app).get('/anything').set('Authorization', header);

    assert.equal(res.status, 401);
  });

  it('lets a valid token through to the protected routes', async () => {
    const { app, authorize } = buildTestApp();

    const res = await request(app).get('/anything').set('Authorization', authorize(ADMIN));

    assert.equal(res.status, 404);
  });
});
