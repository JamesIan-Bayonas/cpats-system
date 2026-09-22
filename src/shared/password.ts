import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'scrypt';
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 32 * 1024 * 1024;

export function hashPassword(password: string): string {
  if (password.length < 16) {
    throw new Error('Seeded account passwords must contain at least 16 characters.');
  }

  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [algorithm, costValue, blockValue, parallelValue, saltValue, hashValue] = storedHash.split('$');
    if (algorithm !== ALGORITHM || !saltValue || !hashValue) return false;

    const cost = Number(costValue);
    const blockSize = Number(blockValue);
    const parallelization = Number(parallelValue);
    if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) return false;

    const expectedHash = Buffer.from(hashValue, 'base64url');
    if (expectedHash.length !== KEY_LENGTH) return false;

    const suppliedHash = scryptSync(password, Buffer.from(saltValue, 'base64url'), expectedHash.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: MAX_MEMORY,
    });

    return timingSafeEqual(suppliedHash, expectedHash);
  } catch {
    return false;
  }
}
