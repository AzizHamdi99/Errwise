import { MAX_BULK_ISSUES, bulkUpdateIssuesSchema } from '@errwise/shared';

const id = (n: number) =>
  `0198f1a2-7b3c-7d4e-8f50-${String(n).padStart(12, '0')}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => id(i));

describe('bulkUpdateIssuesSchema', () => {
  it.each([
    ['one id', { issueIds: ids(1), status: 'resolved' }],
    [
      'the maximum number of ids',
      { issueIds: ids(MAX_BULK_ISSUES), status: 'ignored' },
    ],
    ['reopening', { issueIds: ids(3), status: 'unresolved' }],
  ])('accepts %s', (_label, body) => {
    expect(bulkUpdateIssuesSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['no id', { issueIds: [], status: 'resolved' }],
    [
      'more ids than allowed',
      { issueIds: ids(MAX_BULK_ISSUES + 1), status: 'resolved' },
    ],
    ['the same id twice', { issueIds: [id(1), id(1)], status: 'resolved' }],
    [
      'an id that is not a uuid',
      { issueIds: ['1; DROP TABLE "Issue"'], status: 'resolved' },
    ],
    ['an unknown status', { issueIds: ids(1), status: 'deleted' }],
    ['no status', { issueIds: ids(1) }],
    ['no ids field', { status: 'resolved' }],
    ['ids that are not a list', { issueIds: id(1), status: 'resolved' }],
  ])('rejects %s', (_label, body) => {
    expect(bulkUpdateIssuesSchema.safeParse(body).success).toBe(false);
  });
});
