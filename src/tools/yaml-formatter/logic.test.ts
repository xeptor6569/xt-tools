import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { formatYaml } from './logic.ts';
import meta from './meta.ts';

const fmt = (input: string, options?: Parameters<typeof formatYaml>[1]) => formatYaml(input, options).text;

describe('formatYaml', () => {
  it('normalises spacing with the defaults', () => {
    expect(fmt('a:   1\nb:    [1,   2]\nc:\n    - x\n    -   y\n')).toBe('a: 1\nb: [1, 2]\nc:\n  - x\n  - y\n');
  });

  it('keeps comments, anchors, aliases and tags (YAML 1.2 spec example 2.10)', () => {
    const input = [
      '---',
      'hr:',
      '  - Mark McGwire',
      '  # Following node labeled SS',
      '  - &SS Sammy Sosa',
      'rbi:',
      '  - *SS # Subsequent occurrence',
      '  - Ken Griffey',
      '',
    ].join('\n');
    expect(fmt(input)).toBe(input);
    expect(fmt('date: !!str 2001-12-14\n')).toBe('date: !!str 2001-12-14\n');
  });

  it('formats multi-document streams', () => {
    const result = formatYaml('one:   1\n---\ntwo:   2\n...\n---\n# third\nthree: 3');
    expect(result.text).toBe('one: 1\n---\ntwo: 2\n...\n---\n# third\nthree: 3\n');
    expect(result.documents).toBe(3);
  });

  it('supports four-space indentation and unindented lists', () => {
    expect(fmt('a:\n  b:\n    - 1\n', { indent: 4 })).toBe('a:\n    b:\n        - 1\n');
    expect(fmt('a:\n  - 1\n  - 2\n', { indentSeq: false })).toBe('a:\n- 1\n- 2\n');
  });

  it('sorts keys recursively and stably, moving comments with their keys', () => {
    const input = 'b: 1\na: {d: 1, c: 2}\n# about l\nl:\n  - z: 1\n    y: 2\n';
    expect(fmt(input, { sortKeys: true })).toBe('a: {c: 2, d: 1}\nb: 1\n# about l\nl:\n  - y: 2\n    z: 1\n');
  });

  it('switches collection style', () => {
    expect(fmt('a: [1, {b: 2}]', { collections: 'block' })).toBe('a:\n  - 1\n  - b: 2\n');
    expect(fmt('a:\n  - 1\n  - b: 2\n', { collections: 'flow' })).toBe('{a: [1, {b: 2}]}\n');
  });

  it('changes string quoting without changing values', () => {
    const input = 'a: "x"\nb: plain\n"c": \'it is\'\nd: "123"\ne: |\n  literal\n';
    expect(fmt(input, { quotes: 'plain' })).toBe('a: x\nb: plain\nc: it is\nd: "123"\ne: |\n  literal\n');
    expect(fmt(input, { quotes: 'single' })).toBe("a: 'x'\nb: 'plain'\n\"c\": 'it is'\nd: '123'\ne: |\n  literal\n");
    expect(fmt(input, { quotes: 'double' })).toBe('a: "x"\nb: "plain"\n"c": "it is"\nd: "123"\ne: |\n  literal\n');
  });

  it('folds long strings at the line width, or never with 0', () => {
    const input = `a: ${'word '.repeat(30).trim()}\n`;
    expect(fmt(input, { lineWidth: 0 })).toBe(input);
    const folded = fmt(input, { lineWidth: 40 }).split('\n');
    expect(folded.length).toBeGreaterThan(3);
    expect(folded.every((line) => line.length <= 40)).toBe(true);
  });

  it('keeps a comment-only stream', () => {
    expect(fmt('# just\n#  a comment\n')).toBe('# just\n#  a comment\n');
  });

  it('returns nothing for empty input', () => {
    expect(formatYaml('')).toEqual({ text: '', warnings: [], documents: 0 });
    expect(fmt('  \n\t\n')).toBe('');
  });

  it('reports errors with line and column', () => {
    expect(() => fmt('a: 1\na: 2')).toThrow('Invalid YAML at line 2, column 1: the key "a" appears twice.');
    expect(() => fmt('a: [1\nb: 2')).toThrow(/^Invalid YAML at line 2, column 1: /);
    expect(() => fmt('a: 1\n  b: 2')).toThrow(/line 1, column 4.*and 1 more error/);
    expect(() => fmt('x: *nope')).toThrow(ToolInputError);
    expect(() => fmt('['.repeat(5000))).toThrow(ToolInputError);
    expect(() => fmt('['.repeat(2000) + ']'.repeat(2000))).toThrow(/nested too deeply/);
  });

  it('treats 1 and "1" as different keys', () => {
    expect(fmt('1: a\n"1": b\n')).toBe('1: a\n"1": b\n');
  });

  it('reports warnings without failing', () => {
    const result = formatYaml('!!foo bar');
    expect(result.text).toBe('!!foo bar\n');
    expect(result.warnings).toEqual(['Warning at line 1, column 1: Unresolved tag: tag:yaml.org,2002:foo']);
  });

  it('never expands alias bombs', () => {
    let bomb = 'a: &a ["lol","lol","lol","lol","lol","lol","lol","lol","lol"]\n';
    for (let i = 1; i < 10; i++) {
      const name = String.fromCharCode(97 + i);
      const prev = String.fromCharCode(96 + i);
      bomb += `${name}: &${name} [${Array(9).fill(`*${prev}`).join(', ')}]\n`;
    }
    const start = performance.now();
    expect(fmt(bomb).length).toBeLessThan(1000);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('formats a large mapping in linear time', () => {
    const big = Array.from({ length: 10_000 }, (_, i) => `key${i}:\n  name: "value ${i}"\n  list: [1, 2] # c`).join(
      '\n',
    );
    const start = performance.now();
    expect(fmt(big).split('\n')).toHaveLength(30_001);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('runs the meta examples', () => {
    for (const { input, expect: expected } of meta.examples ?? []) expect(fmt(input)).toContain(expected);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(formatYaml, {
      malformed: [
        '"'.repeat(200_000),
        ':\n'.repeat(50_000),
        '- [{'.repeat(20_000),
        '{a: '.repeat(20_000),
        '*a',
        '&a [*a]',
        '%TAG !',
        '--- |\n\t\tx',
        'a: !!binary |\n  not base64 ***',
        '\u{1F680} \uD800 <script>alert(1)</script>',
      ],
    });
  });
});
