import { randomInt } from 'node:crypto';
import { sha256 } from '../../common/utils/hash';

const KEY_PREFIX = 'ew_live_';
const RANDOM_LENGTH = 32;
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** `ew_live_` followed by exactly 32 alphanumeric characters. */
export const API_KEY_PATTERN = /^ew_live_[A-Za-z0-9]{32}$/;

export interface GeneratedApiKey {
  key: string;
  prefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  let random = '';
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    random += ALPHABET[randomInt(ALPHABET.length)];
  }
  const key = `${KEY_PREFIX}${random}`;
  return { key, prefix: key.slice(0, 12), keyHash: sha256(key) };
}

export function hashApiKey(key: string): string {
  return sha256(key);
}
