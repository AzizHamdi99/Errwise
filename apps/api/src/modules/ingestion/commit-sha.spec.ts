import { commitFromRelease, resolveCommitSha } from './commit-sha';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('commitFromRelease', () => {
  it('recognizes a release that is a commit hash, short or full', () => {
    expect(commitFromRelease(SHA)).toBe(SHA);
    expect(commitFromRelease('a1b2c3d')).toBe('a1b2c3d');
    expect(commitFromRelease('  A1B2C3D  ')).toBe('a1b2c3d');
  });

  it('does not mistake versions, dates or build numbers for a commit', () => {
    for (const release of [
      '1.4.0',
      'v1.4.0',
      '2026.11.20',
      '20261120', // a date: hex characters only, no letter
      '1234567', // a build number
      'release-1',
      'abc12', // too short
      'g'.repeat(40),
      '',
      undefined,
    ]) {
      expect(commitFromRelease(release)).toBeUndefined();
    }
  });
});

describe('resolveCommitSha', () => {
  it('prefers the commit the SDK sent', () => {
    expect(resolveCommitSha('abcdef1', SHA)).toBe('abcdef1');
  });

  it('falls back to a release that looks like a commit', () => {
    expect(resolveCommitSha(undefined, SHA)).toBe(SHA);
  });

  it('is undefined when neither is a commit', () => {
    expect(resolveCommitSha(undefined, '1.4.0')).toBeUndefined();
    expect(resolveCommitSha(undefined, undefined)).toBeUndefined();
  });
});
