import { ISSUE_SORTS } from '@errwise/shared';
import type { IssueSort } from '@errwise/shared';
import { decodeCursor, encodeCursor } from './issues.cursor';

const ID = '0198f1a2-7b3c-7d4e-8f50-123456789abc';
const LAST_SEEN = new Date('2026-11-20T15:42:10.123Z');
const FIRST_SEEN = new Date('2026-11-01T08:00:00.456Z');
const ISSUE = {
  id: ID,
  lastSeenAt: LAST_SEEN,
  firstSeenAt: FIRST_SEEN,
  eventCount: 4242,
};

const raw = (text: string) => Buffer.from(text).toString('base64url');
const iso = LAST_SEEN.toISOString();

describe('issue cursor', () => {
  it('round-trips each sort with the right value, keeping the milliseconds', () => {
    expect(decodeCursor(encodeCursor('lastSeen', ISSUE), 'lastSeen')).toEqual({
      value: LAST_SEEN,
      id: ID,
    });
    expect(decodeCursor(encodeCursor('firstSeen', ISSUE), 'firstSeen')).toEqual(
      { value: FIRST_SEEN, id: ID },
    );
    expect(decodeCursor(encodeCursor('events', ISSUE), 'events')).toEqual({
      value: 4242,
      id: ID,
    });
  });

  it('is url-safe, so it can travel in a query string as it is', () => {
    for (const sort of ISSUE_SORTS) {
      expect(encodeCursor(sort, ISSUE)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it.each(
    ISSUE_SORTS.flatMap((made) =>
      ISSUE_SORTS.filter((used) => used !== made).map(
        (used) => [made, used] as [IssueSort, IssueSort],
      ),
    ),
  )(
    'rejects a cursor made for "%s" when the list is sorted by "%s"',
    (made, used) => {
      expect(decodeCursor(encodeCursor(made, ISSUE), used)).toBeNull();
    },
  );

  it.each([
    ['an empty string', ''],
    ['text that is not base64url', '%%%'],
    ['the old format (date|id, no sort)', raw(`${iso}|${ID}`)],
    ['a missing value', raw(`lastSeen||${ID}`)],
    ['a missing id', raw(`lastSeen|${iso}|`)],
    ['an extra segment', raw(`lastSeen|${iso}|${ID}|x`)],
    ['an unknown sort', raw(`name|${iso}|${ID}`)],
    ['a date that is not strict ISO', raw(`lastSeen|2026|${ID}`)],
    ['a date without milliseconds', raw(`lastSeen|2026-11-20T15:42:10Z|${ID}`)],
    ['an invalid date', raw(`lastSeen|2026-13-45T99:99:99.000Z|${ID}`)],
    ['an id that is not a uuid', raw(`lastSeen|${iso}|1; DROP TABLE`)],
  ])('rejects %s', (_label, cursor) => {
    expect(decodeCursor(cursor, 'lastSeen')).toBeNull();
  });

  it.each([
    ['a negative number', '-1'],
    ['a decimal', '1.5'],
    ['text', 'many'],
    ['an exponent', '1e3'],
    ['more than a Postgres integer holds', '2147483648'],
    ['a date', iso],
  ])('rejects an events value that is %s', (_label, value) => {
    expect(decodeCursor(raw(`events|${value}|${ID}`), 'events')).toBeNull();
  });

  it('accepts the largest Postgres integer and zero', () => {
    expect(decodeCursor(raw(`events|2147483647|${ID}`), 'events')?.value).toBe(
      2_147_483_647,
    );
    expect(decodeCursor(raw(`events|0|${ID}`), 'events')?.value).toBe(0);
  });
});
