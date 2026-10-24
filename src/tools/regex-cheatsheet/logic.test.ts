import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, regexCheatsheet } from './logic.ts';
import meta from './meta.ts';

const syntaxes = (query: string, section?: string) => regexCheatsheet(rows, query, section).map((r) => r.syntax);

/** Example patterns in the sheet that must be valid JavaScript regexes, with their flags. */
const JS_EXAMPLES: Array<[string, string]> = [
  ['\\d+(?=px)', ''],
  ['(?<=\\$)\\d+', ''],
  ['\\b(\\w+)\\s+\\1\\b', ''],
  ['[\\w--\\d]', 'v'],
  ['[\\p{L}&&\\p{ASCII}]', 'v'],
  ['\\p{RGI_Emoji}', 'v'],
  ['[\\q{abc|def}]', 'v'],
  ['^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$', 'i'],
  ['\\B(?=(\\d{3})+(?!\\d))', 'g'],
  ['(?i:abc)', ''],
  ['(?-i:abc)', 'i'],
  ['(?<y>\\d{4})-\\d\\d|\\d\\d-(?<y>\\d{4})', ''],
  ['[^]', ''],
];

describe('regex cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(220);
  });

  it('has non-empty, trimmed fields in every row', () => {
    for (const row of rows) {
      for (const value of [row.section, row.syntax, row.description]) {
        expect(value.trim(), JSON.stringify(row)).toBe(value);
        expect(value.length, JSON.stringify(row)).toBeGreaterThan(0);
      }
      expect(row.description, row.syntax).toMatch(/[.)]$/);
    }
  });

  it('has no duplicate syntax within a section', () => {
    const keys = rows.map((r) => `${r.section}\u0000${r.syntax}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only listed sections, and every section has rows', () => {
    const used = new Set(rows.map((r) => r.section));
    for (const s of used) expect(SECTIONS).toContain(s);
    for (const s of SECTIONS) expect(used.has(s), s).toBe(true);
  });

  it('keeps backslashes intact', () => {
    expect(syntaxes('', 'Character classes')).toEqual(expect.arrayContaining(['\\d', '\\D', '\\w', '\\s']));
  });

  it('lists example patterns that really work in JavaScript', () => {
    const all = new Set(rows.map((r) => r.syntax));
    for (const [source, flags] of JS_EXAMPLES) {
      expect(all.has(source), source).toBe(true);
      expect(() => new RegExp(source, flags), source).not.toThrow();
    }
    expect('1234567'.replace(/\B(?=(\d{3})+(?!\d))/g, ',')).toBe('1,234,567');
    expect('12px'.match(/\d+(?=px)/)?.[0]).toBe('12');
    expect('a1_b'.match(/[\w--\d]+/v)?.[0]).toBe('a');
    expect('👩‍👩‍👧‍👦'.match(/\p{RGI_Emoji}/v)?.[0]).toBe('👩‍👩‍👧‍👦');
  });
});

describe('regexCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(regexCheatsheet(rows, '')).toHaveLength(rows.length);
  });

  it('finds known entries', () => {
    expect(syntaxes('lookbehind')).toEqual(expect.arrayContaining(['(?<=abc)', '(?<!abc)']));
    expect(syntaxes('possessive')).toContain('*+');
    expect(syntaxes('named group')).toContain('(?<name>abc)');
    expect(syntaxes('emoji')).toContain('\\p{RGI_Emoji}');
  });

  it('ranks the exact, case-sensitive syntax first', () => {
    expect(syntaxes('\\D')[0]).toBe('\\D');
    expect(syntaxes('\\d')[0]).toBe('\\d');
    expect(syntaxes('$&')[0]).toBe('$&');
  });

  it('matches every term ignoring case', () => {
    expect(syntaxes('WORD boundary')).toContain('\\b');
    expect(syntaxes('lazy zzz-nothing')).toEqual([]);
  });

  it('filters by section', () => {
    const flags = regexCheatsheet(rows, '', 'Flags & modifiers');
    expect(flags.length).toBeGreaterThan(8);
    expect(flags.every((r) => r.section === 'Flags & modifiers')).toBe(true);
    expect(syntaxes('group 1', 'Replacement')).toEqual(expect.arrayContaining(['$1', '\\1']));
    expect(syntaxes('group 1', 'Replacement')).not.toContain('(abc)');
    expect(regexCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(regexCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = regexCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => regexCheatsheet(rows, q), { malformed: ['(?<=', '[\\', '$&$1\\'] });
    expectRobust((q) => regexCheatsheet(rows, q, 'Unicode'));
  });
});
