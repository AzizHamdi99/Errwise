import { sliceAround } from './source-lines';

const file = (count: number) =>
  Array.from({ length: count }, (_, i) => `line ${i + 1}`).join('\n');

describe('sliceAround', () => {
  it('returns the failing line with five lines on each side', () => {
    const window = sliceAround(file(30), 15);
    expect(window?.startLine).toBe(10);
    expect(window?.lines).toHaveLength(11);
    expect(window?.lines[5]).toBe('line 15');
  });

  it('stops at the start and the end of the file', () => {
    expect(sliceAround(file(30), 2)).toMatchObject({ startLine: 1 });
    expect(sliceAround(file(30), 2)?.lines).toHaveLength(7); // lines 1 to 7
    const end = sliceAround(file(30), 29);
    expect(end?.startLine).toBe(24);
    expect(end?.lines.at(-1)).toBe('line 30');
  });

  it('works on a one-line file', () => {
    expect(sliceAround('only', 1)).toEqual({ startLine: 1, lines: ['only'] });
  });

  it('gives nothing when the file is shorter than the line', () => {
    expect(sliceAround(file(10), 11)).toBeNull();
    expect(sliceAround('', 1)).toBeNull();
  });

  it('rejects impossible line numbers', () => {
    for (const bad of [0, -3, 1.5, Number.NaN]) {
      expect(sliceAround(file(10), bad)).toBeNull();
    }
  });

  it('handles Windows line endings and a trailing newline', () => {
    const window = sliceAround('a\r\nb\r\nc\r\n', 2);
    expect(window?.lines).toEqual(['a', 'b', 'c']);
    expect(sliceAround('a\nb\n', 3)).toBeNull(); // the final newline is not a line
  });

  it('cuts very long lines', () => {
    const minified = 'x'.repeat(5_000);
    const window = sliceAround(`before\n${minified}\nafter`, 2);
    expect(window?.lines[1]).toHaveLength(301);
    expect(window?.lines[1]?.endsWith('…')).toBe(true);
  });
});
