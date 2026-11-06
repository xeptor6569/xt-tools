import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { detectSplit, listConverter, splitOnUrls } from './logic.ts';

const run = (input: string, o: Parameters<typeof listConverter>[1] = {}) => listConverter(input, o).text;

describe('listConverter', () => {
  it('detects the separator', () => {
    expect(detectSplit('a\nb')).toBe('newline');
    expect(detectSplit('a, b')).toBe('comma');
    expect(detectSplit('a;b')).toBe('semicolon');
    expect(detectSplit('a\tb')).toBe('tab');
    expect(detectSplit('a b')).toBe('space');
  });

  it('turns a column into a quoted, comma-separated list', () => {
    expect(
      run('apple\nbanana\n\ncherry ', { join: 'comma-space', prefix: "'", suffix: "'", open: '(', close: ')' }),
    ).toBe("('apple', 'banana', 'cherry')");
  });

  it('dedupes, changes case and sorts', () => {
    expect(run('b, a, B, c, a', { dedupe: true, sort: 'asc' })).toBe('a\nb\nB\nc');
    expect(run('b, a, B, c, a', { dedupe: true, caseMode: 'lower', sort: 'desc' })).toBe('c\nb\na');
    expect(run('item10,item2,item1', { sort: 'natural' })).toBe('item1\nitem2\nitem10');
    expect(run('ccc,a,bb', { sort: 'length', join: 'comma' })).toBe('a,bb,ccc');
    expect(run('1,2,3', { sort: 'reverse', join: 'space' })).toBe('3 2 1');
  });

  it('keeps empty items when asked', () => {
    expect(run('a,,b', { removeEmpty: false, join: 'pipe' })).toBe('a||b');
  });

  it('shuffles every item exactly once', () => {
    const items = Array.from({ length: 50 }, (_, i) => String(i));
    const out = run(items.join('\n'), {
      sort: 'shuffle',
      random: (n) => crypto.getRandomValues(new Uint8Array(n)),
    }).split('\n');
    expect([...out].sort()).toEqual([...items].sort());
    expect(out).not.toEqual(items);
  });

  it('splits links where the separator was deleted', () => {
    const stuck = 'https://example.com/ahttps://example.com/bhttp://example.com/c';
    expect(splitOnUrls(stuck)).toEqual(['https://example.com/a', 'https://example.com/b', 'http://example.com/c']);
    expect(run(stuck, { join: 'newline' })).toBe('https://example.com/a\nhttps://example.com/b\nhttp://example.com/c');
    expect(run('HTTPS://Example.com/ahttps://example.com/b', { join: 'newline' })).toBe(
      'HTTPS://Example.com/a\nhttps://example.com/b',
    );
    expect(
      run('https://example.com/ahttps://example.com/b\nhttps://example.com/chttps://example.com/d', {
        join: 'newline',
      }),
    ).toBe('https://example.com/a\nhttps://example.com/b\nhttps://example.com/c\nhttps://example.com/d');
    expect(run('https://example.com/only', { join: 'newline' })).toBe('https://example.com/only');
    expect(run('apple, banana', { join: 'newline' })).toBe('apple\nbanana');
  });

  it('splits on web links even when another separator is present', () => {
    expect(run('https://example.com/a https://example.com/b', { split: 'url', join: 'newline' })).toBe(
      'https://example.com/a\nhttps://example.com/b',
    );
    expect(run('see https://example.com/ahttps://example.com/b', { split: 'url', join: 'newline' })).toBe(
      'see\nhttps://example.com/a\nhttps://example.com/b',
    );
  });

  it('counts the items', () => {
    expect(listConverter('a\nb\n\nc').count).toBe(3);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => listConverter(s, { dedupe: true, sort: 'natural' }), { timeLimitMs: 5000 });
  });
});
