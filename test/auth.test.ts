import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/modules/auth/password';

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
