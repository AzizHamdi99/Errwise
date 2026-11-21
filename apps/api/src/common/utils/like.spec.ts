import { escapeLike } from './like';

describe('escapeLike', () => {
  it.each([
    ['timeout', 'timeout'],
    ['100%', '100\\%'],
    ['user_id', 'user\\_id'],
    ['a\\b', 'a\\\\b'],
    ['%_\\', '\\%\\_\\\\'],
    ['', ''],
  ])('escapes %j as %j', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });

  it('leaves other characters alone, including quotes and regex characters', () => {
    expect(escapeLike(`it's (a.b)* [x] "y"`)).toBe(`it's (a.b)* [x] "y"`);
  });

  it('escapes the backslash first, so an escape cannot be smuggled in', () => {
    // the user typed \% : the result must still match a literal backslash then a percent sign
    expect(escapeLike('\\%')).toBe('\\\\\\%');
  });
});
