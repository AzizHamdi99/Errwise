import {
  buildTitle,
  computeFingerprint,
  normalizeMessage,
  topAppFrame,
} from './fingerprint';

const STACK = `TypeError: x is undefined
    at getUser (/app/src/users/users.service.js:10:5)
    at /app/node_modules/express/lib/router/layer.js:95:5
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

describe('normalizeMessage', () => {
  it('replaces numbers', () => {
    expect(normalizeMessage('User 4521 not found')).toBe('user <n> not found');
  });

  it('replaces quoted values', () => {
    expect(normalizeMessage("Cannot read property 'name' of undefined")).toBe(
      'cannot read property <str> of undefined',
    );
  });

  it('keeps apostrophes inside words', () => {
    expect(normalizeMessage("can't find user's file")).toBe(
      "can't find user's file",
    );
  });

  it('replaces uuids and hex values', () => {
    expect(
      normalizeMessage('Order 550e8400-e29b-41d4-a716-446655440000 failed'),
    ).toBe('order <uuid> failed');
    expect(normalizeMessage('Bad pointer 0xDEADBEEF')).toBe(
      'bad pointer <hex>',
    );
  });
});

describe('topAppFrame', () => {
  it('returns the first frame outside node_modules and node internals', () => {
    expect(topAppFrame(STACK)).toBe('getUser@src/users/users.service.js');
  });

  it('ignores the line and column numbers', () => {
    expect(topAppFrame(STACK.replace(':10:5', ':99:1'))).toBe(
      'getUser@src/users/users.service.js',
    );
  });

  it('handles anonymous frames, async frames and Windows paths', () => {
    expect(topAppFrame('Error: x\n    at /app/src/a.js:1:1')).toBe(
      '<anonymous>@app/src/a.js',
    );
    expect(
      topAppFrame('Error: x\n    at async run (C:\\app\\src\\job.js:3:7)'),
    ).toBe('run@app/src/job.js');
  });

  it('returns null when there is no application frame', () => {
    expect(topAppFrame(undefined)).toBeNull();
    expect(
      topAppFrame('Error: x\n    at f (/app/node_modules/lib/index.js:1:1)'),
    ).toBeNull();
  });
});

describe('computeFingerprint', () => {
  const base = { type: 'TypeError', message: 'User 1 not found', stack: STACK };

  it('is stable for the same error', () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base }));
  });

  it('groups messages that differ only by numbers', () => {
    expect(computeFingerprint(base)).toBe(
      computeFingerprint({ ...base, message: 'User 98 not found' }),
    );
  });

  it('separates different types, messages and code locations', () => {
    const fp = computeFingerprint(base);
    expect(computeFingerprint({ ...base, type: 'RangeError' })).not.toBe(fp);
    expect(
      computeFingerprint({ ...base, message: 'Order 1 not found' }),
    ).not.toBe(fp);
    expect(
      computeFingerprint({
        ...base,
        stack: STACK.replace('getUser', 'getOrder'),
      }),
    ).not.toBe(fp);
  });

  it('works without a stack', () => {
    expect(computeFingerprint({ type: 'Error', message: 'boom' })).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

describe('buildTitle', () => {
  it('uses the type and the first line, truncated', () => {
    expect(buildTitle('Error', 'first\nsecond')).toBe('Error: first');
    expect(buildTitle('Error', 'x'.repeat(500))).toHaveLength(200);
  });
});
