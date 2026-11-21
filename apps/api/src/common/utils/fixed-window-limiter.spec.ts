import { FixedWindowLimiter } from './fixed-window-limiter';

describe('FixedWindowLimiter', () => {
  function setup(limit = 3, windowMs = 10_000) {
    let now = 1_000_000;
    const limiter = new FixedWindowLimiter(limit, windowMs, () => now);
    return {
      limiter,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }

  it('allows up to the limit, then blocks', () => {
    const { limiter } = setup(3);

    expect([1, 2, 3].map(() => limiter.hit('ip').allowed)).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.hit('ip').allowed).toBe(false);
    expect(limiter.hit('ip').allowed).toBe(false);
  });

  it('says how long to wait, rounded up to whole seconds and never 0', () => {
    const { limiter, advance } = setup(1, 10_000);
    limiter.hit('ip');

    advance(2_500);
    expect(limiter.hit('ip')).toEqual({ allowed: false, retryAfterSeconds: 8 });

    advance(7_499);
    expect(limiter.hit('ip').retryAfterSeconds).toBe(1);
  });

  it('starts a new window when the old one is over', () => {
    const { limiter, advance } = setup(1, 10_000);
    limiter.hit('ip');
    expect(limiter.hit('ip').allowed).toBe(false);

    advance(10_000);
    expect(limiter.hit('ip').allowed).toBe(true);
  });

  it('counts each key on its own', () => {
    const { limiter } = setup(1);
    limiter.hit('a');

    expect(limiter.hit('a').allowed).toBe(false);
    expect(limiter.hit('b').allowed).toBe(true);
  });

  it('keeps its memory bounded: when full of live windows the oldest is dropped', () => {
    const { limiter } = setup(1);
    limiter.hit('first');
    expect(limiter.hit('first').allowed).toBe(false);

    // more distinct keys than it keeps: 'first' was the oldest, so it is forgotten
    for (let i = 0; i < 10_000; i++) limiter.hit(`other-${i}`);

    expect(limiter.hit('first').allowed).toBe(true);
  });
});
