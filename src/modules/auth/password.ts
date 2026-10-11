import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

interface StoredHash {
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
}

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const CURRENT_PARAMS: ScryptParams = { N: 16_384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, CURRENT_PARAMS);
  const { N, r, p } = CURRENT_PARAMS;
  return [ALGORITHM, N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const stored = parseStoredHash(storedHash);
  if (!stored) return false;

  const actual = await deriveKey(password, stored.salt, stored.params);
  return timingSafeEqual(actual, stored.key);
}

function parseStoredHash(storedHash: string): StoredHash | undefined {
  const [algorithm, N, r, p, salt, key, ...extra] = storedHash.split('$');
  if (algorithm !== ALGORITHM || salt === undefined || key === undefined || extra.length > 0) {
    return undefined;
  }

  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((value) => Number.isSafeInteger(value) && value > 0)) {
    return undefined;
  }
  if (params.N < 2 || (params.N & (params.N - 1)) !== 0) return undefined;

  const keyBytes = Buffer.from(key, 'base64');
  if (keyBytes.length !== KEY_LENGTH) return undefined;
  return { params, salt: Buffer.from(salt, 'base64'), key: keyBytes };
}

function deriveKey(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // scrypt needs about 128 * N * r bytes; the default 32 MB cap would reject any raised cost
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}
