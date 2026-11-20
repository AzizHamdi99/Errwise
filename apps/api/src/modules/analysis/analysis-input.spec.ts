import type { Event } from '@prisma/client';
import { buildAnalysisInput, hashAnalysisInput } from './analysis-input';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    eventId: 'ev1',
    projectId: 'p1',
    issueId: 'i1',
    level: 'error',
    type: 'TypeError',
    message: 'boom',
    stack: 'TypeError: boom\n    at f (/app/a.js:1:1)',
    platform: 'node',
    environment: 'production',
    release: '1.0.0',
    commitSha: null,
    sdk: null,
    context: null,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    receivedAt: new Date('2026-01-01T00:00:01Z'),
    ...overrides,
  };
}

describe('buildAnalysisInput', () => {
  it('scrubs events that were stored before scrubbing existed', () => {
    const input = buildAnalysisInput(
      { type: 'TypeError' },
      event({
        message: 'User bob@x.com failed with Bearer abcdef1234567890xyz',
        stack:
          'Error\n    at f (/app/a.js:1:1) password=hunter2 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlMTIzNDU2',
      }),
    );

    const sent = JSON.stringify(input);
    expect(sent).not.toMatch(/bob@x\.com|abcdef1234567890xyz|eyJhbGci/);
    expect(input.message).toBe('User [email] failed with Bearer [token]');
  });

  it('never sends the free-form context, only the node version from it', () => {
    const input = buildAnalysisInput(
      { type: null },
      event({
        context: {
          nodeVersion: 'v22.3.0',
          hostname: 'web-1',
          extra: { secretThing: 'x' },
        },
      }),
    );

    expect(input.runtime).toBe('node 22.3.0');
    expect(JSON.stringify(input)).not.toMatch(/web-1|secretThing/);
  });

  it('falls back to the issue type, then to Error', () => {
    expect(
      buildAnalysisInput({ type: 'RangeError' }, event({ type: null })).type,
    ).toBe('RangeError');
    expect(buildAnalysisInput({ type: null }, event({ type: null })).type).toBe(
      'Error',
    );
  });

  it('keeps the result inside the limits even when scrubbing makes text longer', () => {
    const message = 'a@b.co '.repeat(1_000); // 7,000 chars, each address grows by one
    const input = buildAnalysisInput({ type: null }, event({ message }));
    expect(input.message.length).toBeLessThanOrEqual(5_000);
  });

  it('leaves optional fields out when the event has none', () => {
    const input = buildAnalysisInput(
      { type: null },
      event({ stack: null, release: null, context: null }),
    );
    expect(input.stack).toBeUndefined();
    expect(input.release).toBeUndefined();
    expect(input.runtime).toBeUndefined();
  });
});

describe('hashAnalysisInput', () => {
  const base = buildAnalysisInput({ type: null }, event());

  it('is stable for the same input', () => {
    expect(hashAnalysisInput(base)).toBe(
      hashAnalysisInput(buildAnalysisInput({ type: null }, event())),
    );
  });

  it('changes when any part of the input changes', () => {
    const hashes = new Set([
      hashAnalysisInput(base),
      hashAnalysisInput({
        ...base,
        stack: `${base.stack}\n    at g (/b.js:2:2)`,
      }),
      hashAnalysisInput({ ...base, message: 'other' }),
      hashAnalysisInput({ ...base, release: '2.0.0' }),
      hashAnalysisInput({ ...base, environment: 'staging' }),
    ]);
    expect(hashes.size).toBe(5);
  });
});
