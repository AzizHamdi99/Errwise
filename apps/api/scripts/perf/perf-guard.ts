import { PrismaClient } from '@prisma/client';

export const PERF_ORG_SLUG = 'perf-org';
export const PERF_PROJECT_SLUG = 'perf-project';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * These scripts delete and insert a lot of rows, so they must never touch a remote database.
 * The URL is parsed, not matched with a regex, and it is never printed (it holds credentials).
 */
export function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set.');

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run: the database host is "${host}", not localhost.`,
    );
  }
}

export function createPerfClient(): PrismaClient {
  assertLocalDatabase();
  return new PrismaClient();
}
