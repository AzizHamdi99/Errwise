import { idSchema } from '@errwise/shared';
import type { IssueSort } from '@errwise/shared';

/** The column each sort orders by. Every sort is "that column desc, then id desc". */
export const SORT_FIELD = {
  lastSeen: 'lastSeenAt',
  firstSeen: 'firstSeenAt',
  events: 'eventCount',
} as const satisfies Record<IssueSort, string>;

export interface IssueCursor {
  /** A Date for the date sorts, an integer for "events". */
  value: Date | number;
  id: string;
}

interface CursorSource {
  id: string;
  lastSeenAt: Date;
  firstSeenAt: Date;
  eventCount: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const INT4_MAX = 2_147_483_647; // eventCount is a Postgres integer

/**
 * Keyset pagination: the position is (sort value, id) of the last row of the page.
 * The cursor names its sort, so one made for another sort is rejected instead of silently
 * pointing at the wrong place.
 */
export function encodeCursor(sort: IssueSort, issue: CursorSource): string {
  const value =
    sort === 'events'
      ? String(issue.eventCount)
      : issue[SORT_FIELD[sort]].toISOString();
  return Buffer.from(`${sort}|${value}|${issue.id}`).toString('base64url');
}

export function decodeCursor(raw: string, sort: IssueSort): IssueCursor | null {
  const parts = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (parts.length !== 3) return null;
  const [cursorSort, rawValue, id] = parts;
  if (cursorSort !== sort || !idSchema.safeParse(id).success) return null;

  if (sort === 'events') {
    if (!/^\d+$/.test(rawValue)) return null;
    const value = Number(rawValue);
    return value <= INT4_MAX ? { value, id } : null;
  }

  if (!ISO_DATE.test(rawValue)) return null;
  const value = new Date(rawValue);
  return Number.isNaN(value.getTime()) ? null : { value, id };
}
