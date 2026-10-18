import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { fancyText } from './logic.ts';

const as = (s: string) => Object.fromEntries(fancyText(s).map((v) => [v.label, v.value]));

describe('fancyText', () => {
  it('maps letters and digits to mathematical styles', () => {
    const r = as('Abc 1');
    expect(r.Bold).toBe('𝐀𝐛𝐜 𝟏');
    expect(r['Double-struck']).toBe('𝔸𝕓𝕔 𝟙');
    expect(r.Monospace).toBe('𝙰𝚋𝚌 𝟷');
    expect(r.Fullwidth).toBe('Ａｂｃ １');
  });

  it('uses the Letterlike Symbols block for the "holes"', () => {
    expect(as('h').Italic).toBe('ℎ');
    expect(as('Hello').Script).toBe('ℋℯ𝓁𝓁ℴ');
    expect(as('CHIRZ').Fraktur).toBe('ℭℌℑℜℨ');
    expect(as('CHNPQRZ')['Double-struck']).toBe('ℂℍℕℙℚℝℤ');
  });

  it('produces small caps, circled, upside-down and combining styles', () => {
    const r = as('hi 12');
    expect(r['Small caps']).toBe('ʜɪ 12');
    expect(r.Circled).toBe('ⓗⓘ ①②');
    expect(as('hello!')['Upside down']).toBe('¡ollǝɥ');
    expect(as('ab').Strikethrough).toBe('a\u0336b\u0336');
  });

  it('leaves other characters alone', () => {
    expect(as('é ✓').Bold).toBe('é ✓');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(fancyText);
  });
});
