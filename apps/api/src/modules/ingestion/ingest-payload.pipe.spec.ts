import { IngestPayloadPipe } from './ingest-payload.pipe';

const base = {
  eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ab',
  message: 'boom',
};

describe('IngestPayloadPipe commitSha', () => {
  const pipe = new IngestPayloadPipe();
  const parse = (extra: object) =>
    (pipe.transform({ ...base, ...extra }) as { commitSha?: string }).commitSha;

  it('keeps a valid commit and lowercases it', () => {
    expect(parse({ commitSha: 'ABCDEF1234' })).toBe('abcdef1234');
  });

  it('is optional', () => {
    expect(parse({})).toBeUndefined();
  });

  it('ignores a malformed commit instead of rejecting the error event', () => {
    for (const commitSha of ['main', 'abc', 'x'.repeat(100), 42, null, {}]) {
      expect(() => pipe.transform({ ...base, commitSha })).not.toThrow();
      expect(parse({ commitSha })).toBeUndefined();
    }
  });

  it('works inside a batch too', () => {
    const [event] = pipe.transform([{ ...base, commitSha: 'zzz' }]) as Array<{
      commitSha?: string;
    }>;
    expect(event.commitSha).toBeUndefined();
  });
});
