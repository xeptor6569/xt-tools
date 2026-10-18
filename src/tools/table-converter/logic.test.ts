import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { detectFormat, parseTable, tableConverter, TABLE_FORMATS } from './logic.ts';

const conv = (input: string, to: Parameters<typeof tableConverter>[2], opts = {}) =>
  tableConverter(input, 'auto', to, opts)?.text;

describe('tableConverter', () => {
  const csv = 'Name,Role\nAda,Engineer\nBob,"Ops | on-call"';

  it('CSV → Markdown, padded and aligned', () => {
    expect(conv(csv, 'markdown')).toBe(
      [
        '| Name | Role           |',
        '| ---- | -------------- |',
        '| Ada  | Engineer       |',
        '| Bob  | Ops \\| on-call |',
      ].join('\n'),
    );
    expect(conv(csv, 'markdown', { align: 'center', pad: false })?.split('\n')[1]).toBe('| :-: | :-: |');
  });

  it('CSV → HTML escapes content', () => {
    expect(conv('a\n<b>&', 'html')).toBe(
      '<table>\n  <thead>\n    <tr><th>a</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>&lt;b&gt;&amp;</td></tr>\n  </tbody>\n</table>',
    );
  });

  it('Markdown and HTML parse back', () => {
    expect(parseTable(conv(csv, 'markdown')!, 'markdown')).toEqual([
      ['Name', 'Role'],
      ['Ada', 'Engineer'],
      ['Bob', 'Ops | on-call'],
    ]);
    expect(parseTable(conv(csv, 'html')!, 'html')).toEqual([
      ['Name', 'Role'],
      ['Ada', 'Engineer'],
      ['Bob', 'Ops | on-call'],
    ]);
    expect(parseTable('<table><tr><th>A &amp; B</th></tr><tr><td><b>x</b></td></tr></table>', 'html')).toEqual([
      ['A & B'],
      ['x'],
    ]);
  });

  it('JSON ⇄ table', () => {
    expect(JSON.parse(conv(csv, 'json')!)).toEqual([
      { Name: 'Ada', Role: 'Engineer' },
      { Name: 'Bob', Role: 'Ops | on-call' },
    ]);
    expect(conv('[{"a":1,"b":2},{"a":3,"c":4}]', 'csv')).toBe('a,b,c\n1,2,\n3,,4');
    expect(conv('[["x","y"],[1,2]]', 'tsv')).toBe('x\ty\n1\t2');
  });

  it('pads ragged rows', () => {
    expect(conv('a,b,c\n1', 'csv')).toBe('a,b,c\n1,,');
  });

  it('detects formats', () => {
    expect(detectFormat('[{"a":1}]')).toBe('json');
    expect(detectFormat('<table></table>')).toBe('html');
    expect(detectFormat('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('markdown');
    expect(detectFormat('a\tb\n1\t2')).toBe('tsv');
    expect(detectFormat('a,b')).toBe('csv');
  });

  it('round-trips through every format', () => {
    const table = [
      ['h1', 'h2'],
      ['v1', 'v, "2"'],
    ];
    for (const { value: from } of TABLE_FORMATS) {
      const text = tableConverter('h1,h2\nv1,"v, ""2"""', 'csv', from)!.text;
      expect(tableConverter(text, from, 'csv')!.table, from).toEqual(table);
    }
  });

  it('reports problems clearly', () => {
    expect(() => conv('{"a":1}', 'csv')).toThrow(/array of objects/);
    expect(() => tableConverter('"open', 'csv', 'json')).toThrow(ToolInputError);
    expect(() => tableConverter('<p>no table</p>', 'html', 'csv')).toThrow(/No HTML table/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => tableConverter(s, 'auto', 'markdown'), { timeLimitMs: 8000 });
  });
});
