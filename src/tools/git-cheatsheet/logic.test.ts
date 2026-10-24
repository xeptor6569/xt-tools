import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, gitCheatsheet } from './logic.ts';
import meta from './meta.ts';

const commands = (query: string, section?: string) => gitCheatsheet(rows, query, section).map((r) => r.command);

describe('git cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(220);
  });

  it('has non-empty, trimmed fields in every row', () => {
    for (const row of rows) {
      for (const value of [row.section, row.command, row.description]) {
        expect(value.trim(), JSON.stringify(row)).toBe(value);
        expect(value.length, JSON.stringify(row)).toBeGreaterThan(0);
      }
      expect(row.description, row.command).toMatch(/[.)]$/);
    }
  });

  it('has no duplicate command within a section', () => {
    const keys = rows.map((r) => `${r.section}\u0000${r.command}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only listed sections, and every section has rows', () => {
    const used = new Set(rows.map((r) => r.section));
    for (const s of used) expect(SECTIONS).toContain(s);
    for (const s of SECTIONS) expect(used.has(s), s).toBe(true);
  });

  it('starts every command with git', () => {
    for (const row of rows) expect(row.command).toMatch(/^git /);
  });

  it('prefers switch and restore over checkout', () => {
    expect(commands('switch -c')).toContain('git switch -c <name>');
    expect(commands('restore --staged')).toContain('git restore --staged <file>');
  });
});

describe('gitCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(gitCheatsheet(rows, '')).toHaveLength(rows.length);
    expect(gitCheatsheet(rows, '   ')).toHaveLength(rows.length);
  });

  it('finds known commands', () => {
    expect(commands('rebase')).toContain('git rebase <base>');
    expect(commands('rebase')[0]).toMatch(/^git rebase/);
    expect(commands('stash pop')[0]).toBe('git stash pop');
    expect(commands('force-with-lease')).toEqual(['git push --force-with-lease']);
    expect(commands('pickaxe')).toEqual(['git log -S "<text>"']);
  });

  it('matches every term in any column, ignoring case and accents', () => {
    expect(commands('UNDO LAST commit')).toContain('git reset --soft HEAD~1');
    expect(commands('Bisect Rését')).toEqual(['git bisect reset']);
    expect(commands('stash nothing-like-this')).toEqual([]);
  });

  it('lists verbatim command matches first', () => {
    expect(commands('git tag')[0]).toBe('git tag');
    expect(commands('git diff')[0]).toBe('git diff');
  });

  it('filters by section', () => {
    const stash = gitCheatsheet(rows, '', 'Stash');
    expect(stash.length).toBeGreaterThan(5);
    expect(stash.every((r) => r.section === 'Stash')).toBe(true);
    expect(commands('delete', 'Tags')).toEqual(['git push origin --delete v1.0.0', 'git tag -d v1.0.0']);
    expect(gitCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(gitCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = gitCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => gitCheatsheet(rows, q));
    expectRobust((q) => gitCheatsheet(rows, q, 'Branch'));
  });
});
