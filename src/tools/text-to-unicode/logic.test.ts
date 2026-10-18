import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { textToUnicode } from './logic.ts';

const as = (input: string, all = false) =>
  Object.fromEntries(textToUnicode(input, { all }).map((v) => [v.label, v.value]));

describe('textToUnicode', () => {
  it('escapes non-ASCII characters in every syntax', () => {
    expect(as('é🚀!')).toEqual({
      'Code points': 'U+00E9 U+1F680 U+0021',
      'JavaScript (ES6)': '\\u{E9}\\u{1F680}!',
      'JSON / Java (UTF-16)': '\\u00E9\\uD83D\\uDE80!',
      Python: '\\u00E9\\U0001F680!',
      CSS: '\\0000E9\\01F680!',
      'HTML (hex)': '&#xE9;&#x1F680;!',
      'HTML (decimal)': '&#233;&#128640;!',
      'URL (percent)': '%C3%A9%F0%9F%9A%80!',
      'UTF-8 bytes': 'C3 A9 F0 9F 9A 80 21',
      'UTF-16 code units': '00E9 D83D DE80 0021',
    });
  });

  it('can escape ASCII too', () => {
    expect(as('A', true)['JavaScript (ES6)']).toBe('\\u{41}');
    expect(as('A', true)['URL (percent)']).toBe('%41');
  });

  it('escapes control characters even in ASCII mode', () => {
    expect(as('a\nb')['JSON / Java (UTF-16)']).toBe('a\\u000Ab');
  });

  it('the JSON escape parses back to the original', () => {
    const s = 'Ünïcödé 👩‍👩‍👧 \t';
    expect(JSON.parse(`"${as(s)['JSON / Java (UTF-16)']}"`)).toBe(s);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => textToUnicode(s));
  });
});
