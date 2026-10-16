import { idSchema } from '@errwise/shared';

export interface IssueCursor {
  lastSeenAt: Date;
  id: string;
}

/** Keyset pagination: the position is (lastSeenAt, id) of the last row of the page. */
export function encodeCursor(issue: { lastSeenAt: Date; id: string }): string {
  return Buffer.from(`${issue.lastSeenAt.toISOString()}|${issue.id}`).toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): IssueCursor | null {
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (!iso || !id) return null;

  const lastSeenAt = new Date(iso);
  if (Number.isNaN(lastSeenAt.getTime())) return null;
  if (!idSchema.safeParse(id).success) return null;

  return { lastSeenAt, id };
}
