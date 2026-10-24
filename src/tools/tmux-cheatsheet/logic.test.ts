import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, tmuxCheatsheet } from './logic.ts';
import meta from './meta.ts';

const keys = (query: string, section?: string) => tmuxCheatsheet(rows, query, section).map((r) => r.keys);

describe('tmux cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(220);
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

  it('uses the default Ctrl-b prefix for every session, window and pane binding', () => {
    for (const row of rows.filter((r) => ['Sessions', 'Windows', 'Panes'].includes(r.section))) {
      expect(row.keys, row.description).toMatch(/^(Ctrl-b |tmux|:)/);
    }
  });

  it('has no duplicate prefix bindings across sections', () => {
    const bound = rows.filter((r) => r.keys.startsWith('Ctrl-b ')).map((r) => r.keys);
    expect(new Set(bound).size).toBe(bound.length);
  });
});

describe('tmuxCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(tmuxCheatsheet(rows, '')).toHaveLength(rows.length);
  });

  it('finds known entries', () => {
    expect(keys('detach')[0]).toBe('Ctrl-b d');
    expect(keys('side by side')).toContain('Ctrl-b %');
    expect(keys('zoom')).toEqual(['Ctrl-b z']);
    expect(keys('synchronize')).toEqual([':setw synchronize-panes on']);
  });

  it('ranks the exact, case-sensitive keys first', () => {
    expect(keys('Ctrl-b d')[0]).toBe('Ctrl-b d');
    expect(keys('Ctrl-b D')[0]).toBe('Ctrl-b D');
    expect(keys('V', 'Copy mode (vi keys)')[0]).toBe('V');
  });

  it('matches every term ignoring case', () => {
    expect(keys('RENAME window')).toContain('Ctrl-b ,');
    expect(keys('pane zzz-nothing')).toEqual([]);
  });

  it('filters by section', () => {
    const emacs = tmuxCheatsheet(rows, '', 'Copy mode (emacs keys)');
    expect(emacs.length).toBeGreaterThan(5);
    expect(emacs.every((r) => r.section === 'Copy mode (emacs keys)')).toBe(true);
    expect(keys('start a selection', 'Copy mode (vi keys)')).toEqual(['Space']);
    expect(keys('start a selection', 'Copy mode (emacs keys)')).toEqual(['Ctrl-Space']);
    expect(tmuxCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(tmuxCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = tmuxCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => tmuxCheatsheet(rows, q), { malformed: ['#{', '\\;', '"'] });
    expectRobust((q) => tmuxCheatsheet(rows, q, 'Panes'));
  });
});
