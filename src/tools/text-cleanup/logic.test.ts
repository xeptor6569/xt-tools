import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { textCleanup } from './logic.ts';

const run = (s: string, o: Parameters<typeof textCleanup>[1] = {}) => textCleanup(s, o).text;

describe('textCleanup', () => {
  it('trims lines and collapses blank lines by default', () => {
    expect(run('  a  \r\n\n\n\n b\t\n\n')).toBe('a\n\nb');
  });

  it('removes blank lines, duplicates and extra spaces', () => {
    expect(run('a\n\nb\na\nB\nb', { blankLines: 'remove', dedupe: true })).toBe('a\nb\nB');
    expect(run('a\nA', { dedupe: true, dedupeIgnoreCase: true })).toBe('a');
    expect(run('a    b\t\tc', { collapseSpaces: true })).toBe('a b c');
  });

  it('can keep indentation while removing trailing spaces', () => {
    expect(run('  indented   \n', { trimLines: false, blankLines: 'keep' })).toBe('  indented');
  });

  it('strips invisible characters but keeps emoji joiners', () => {
    expect(run('a\u200bb\ufeffc 👩\u200d👩', { stripInvisible: true })).toBe('abc 👩\u200d👩');
  });

  it('straightens smart quotes and dashes', () => {
    expect(run('“Hi” – it’s…', { smartQuotes: true })).toBe('"Hi" - it\'s...');
  });

  it('reports line counts', () => {
    expect(textCleanup('a\n\n\nb')).toMatchObject({ linesBefore: 4, linesAfter: 3 });
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => textCleanup(s, { dedupe: true, collapseSpaces: true, stripInvisible: true }), {
      timeLimitMs: 5000,
    });
  });
});
