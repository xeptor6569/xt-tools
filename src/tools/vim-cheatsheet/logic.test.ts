import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, vimCheatsheet } from './logic.ts';
import meta from './meta.ts';

const keys = (query: string, section?: string) => vimCheatsheet(rows, query, section).map((r) => r.keys);

describe('vim cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(260);
  });

  it('has non-empty, trimmed fields in every row', () => {
    for (const row of rows) {
      for (const value of [row.section, row.keys, row.description]) {
        expect(value.trim(), JSON.stringify(row)).toBe(value);
        expect(value.length, JSON.stringify(row)).toBeGreaterThan(0);
      }
      expect(row.description, row.keys).toMatch(/[.)]$/);
    }
  });

  it('has no duplicate keys within a section', () => {
    const ids = rows.map((r) => `${r.section}\u0000${r.keys}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only listed sections, and every section has rows', () => {
    const used = new Set(rows.map((r) => r.section));
    for (const s of used) expect(SECTIONS).toContain(s);
    for (const s of SECTIONS) expect(used.has(s), s).toBe(true);
  });

  it('writes control keys consistently as Ctrl-x', () => {
    for (const row of rows) expect(row.keys).not.toMatch(/\bC-|\^[A-Z]\b|<C-/);
  });
});

describe('vimCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(vimCheatsheet(rows, '')).toHaveLength(rows.length);
  });

  it('finds known entries', () => {
    expect(keys('macro')).toEqual(expect.arrayContaining(['q{a-z}', '@{a-z}', '@@']));
    expect(keys('redo')).toContain('Ctrl-r');
    expect(keys('clipboard')).toContain('"+y "+p');
    expect(keys('trailing whitespace')).toEqual([':%s/\\s\\+$//e']);
  });

  it('ranks the exact, case-sensitive keys first', () => {
    expect(keys('G')[0]).toBe('G');
    expect(keys('gg')[0]).toBe('gg');
    expect(keys('ciw')[0]).toBe('iw');
    expect(keys(':%s/old/new/g')[0]).toBe(':%s/old/new/g');
  });

  it('matches every term ignoring case', () => {
    expect(keys('SPLIT vertically')).toEqual(['Ctrl-w v']);
    expect(keys('fold zzz-nothing')).toEqual([]);
  });

  it('filters by section', () => {
    const windows = vimCheatsheet(rows, '', 'Windows');
    expect(windows.length).toBeGreaterThan(8);
    expect(windows.every((r) => r.section === 'Windows')).toBe(true);
    expect(keys('p', 'Visual mode')).toEqual(expect.arrayContaining(['p', 'P']));
    expect(keys('ctrl-r', 'Insert mode')).toEqual(['Ctrl-r {register}']);
    expect(vimCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(vimCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = vimCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => vimCheatsheet(rows, q), { malformed: [':%s/\\(/', '"', '\u001b'] });
    expectRobust((q) => vimCheatsheet(rows, q, 'Motions'));
  });
});
