import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { hasGrammar, tokenize } from './highlight.ts';
import { LANGUAGES } from './languages.ts';
import {
  codeToImage,
  DEFAULT_LAYOUT,
  fitScale,
  layoutCode,
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  MAX_CHARS,
  MAX_LINES,
  tokensToLines,
  validateCode,
  type DrawOp,
  type LayoutOptions,
  type TokenStreamLike,
} from './logic.ts';
import { BACKGROUNDS, findTheme, THEMES } from './themes.ts';

/** Monospace stand-in for canvas measureText: 8 px per code point. */
const measure = (text: string) => [...text].length * 8;
const texts = (ops: DrawOp[]) => ops.flatMap((op) => (op.kind === 'text' ? [op.text] : []));

describe('validateCode', () => {
  it('accepts snippets up to the limits', () => {
    expect(validateCode('a\n'.repeat(MAX_LINES - 1))).toBe('a\n'.repeat(MAX_LINES - 1));
    expect(validateCode('x'.repeat(MAX_CHARS)).length).toBe(MAX_CHARS);
  });

  it('rejects too many lines or characters, counting CRLF and CR as one break', () => {
    expect(() => validateCode('\n'.repeat(MAX_LINES))).toThrow(/maximum is 500/);
    expect(() => validateCode('\r\n'.repeat(MAX_LINES))).toThrow(/maximum is 500/);
    expect(() => validateCode('\r'.repeat(MAX_LINES))).toThrow(/maximum is 500/);
    expect(validateCode('\r\n'.repeat(MAX_LINES - 1))).toHaveLength(2 * (MAX_LINES - 1));
    expect(() => validateCode('x'.repeat(MAX_CHARS + 1))).toThrow(/maximum is 50,000/);
  });
});

describe('tokensToLines', () => {
  it('returns one empty line for empty input', () => {
    expect(tokensToLines('')).toEqual([[]]);
    expect(tokensToLines([])).toEqual([[]]);
  });

  it('inherits the parent group, prefers aliases and the innermost known type', () => {
    const stream: TokenStreamLike = [
      { type: 'tag', content: [{ type: 'punctuation', content: '<' }, 'div'] },
      ' ',
      { type: 'key', alias: 'atrule', content: 'name' },
      { type: 'unknown-thing', content: 'zz' },
      { type: 'string', content: [{ type: 'unknown', content: 'q' }] },
    ];
    expect(tokensToLines(stream)).toEqual([
      [
        { text: '<', type: 'punctuation' },
        { text: 'div', type: 'tag' },
        { text: ' ', type: 'plain' },
        { text: 'name', type: 'keyword' },
        { text: 'zz', type: 'plain' },
        { text: 'q', type: 'string' },
      ],
    ]);
  });

  it('splits multi-line tokens across lines and handles CRLF and CR', () => {
    const stream: TokenStreamLike = ['a\r\n', { type: 'comment', content: '/* one\ntwo\rthree */' }, ' b'];
    expect(tokensToLines(stream)).toEqual([
      [{ text: 'a', type: 'plain' }],
      [{ text: '/* one', type: 'comment' }],
      [{ text: 'two', type: 'comment' }],
      [
        { text: 'three */', type: 'comment' },
        { text: ' b', type: 'plain' },
      ],
    ]);
  });

  it('expands tabs to the next tab stop and drops control characters', () => {
    expect(tokensToLines('\tx\n ab\tc', 4)).toEqual([
      [{ text: '    x', type: 'plain' }],
      [{ text: ' ab c', type: 'plain' }],
    ]);
    expect(tokensToLines('a\u0000b\u007fc')).toEqual([[{ text: 'abc', type: 'plain' }]]);
  });

  it('merges adjacent segments of the same group and keeps emoji intact', () => {
    const stream: TokenStreamLike = [{ type: 'keyword', content: 'let' }, { type: 'keyword', content: ' ' }, '👩‍👩‍👧 日本'];
    expect(tokensToLines(stream)).toEqual([
      [
        { text: 'let ', type: 'keyword' },
        { text: '👩‍👩‍👧 日本', type: 'plain' },
      ],
    ]);
  });
});

describe('Prism tokenizer', () => {
  it('has a grammar for every offered language', () => {
    for (const lang of LANGUAGES) if (lang.grammar) expect(hasGrammar(lang.grammar), lang.id).toBe(true);
  });

  it('tokenizes TypeScript into the expected groups', () => {
    const [line] = tokensToLines(tokenize('const n: number = 1; // hi', 'typescript'));
    expect(line).toEqual([
      { text: 'const', type: 'keyword' },
      { text: ' n', type: 'plain' },
      { text: ':', type: 'operator' },
      { text: ' ', type: 'plain' },
      { text: 'number', type: 'type' },
      { text: ' ', type: 'plain' },
      { text: '=', type: 'operator' },
      { text: ' ', type: 'plain' },
      { text: '1', type: 'number' },
      { text: ';', type: 'punctuation' },
      { text: ' ', type: 'plain' },
      { text: '// hi', type: 'comment' },
    ]);
  });

  it('keeps every character of the source for each language', () => {
    const code = 'if (a < 1) {\n\treturn "x" # y -- z\n}\n<?php echo $v; ?>\n- [ ] item: `code`';
    for (const lang of LANGUAGES) {
      const lines = tokensToLines(tokenize(code, lang.id), 2);
      const text = lines.map((l) => l.map((s) => s.text).join('')).join('\n');
      expect(text, lang.id).toBe(code.replace('\t', '  '));
    }
  });

  it('splits a multi-line Python string across lines', () => {
    const lines = tokensToLines(tokenize('x = """a\nb"""', 'python'));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual([{ text: 'b"""', type: 'string' }]);
  });

  it('highlights PHP inside HTML via the tokenize hooks', () => {
    const lines = tokensToLines(tokenize('<p><?php echo $x; ?></p>', 'php'));
    expect(lines[0]).toContainEqual({ text: 'echo', type: 'keyword' });
    expect(lines[0]).toContainEqual({ text: '$x', type: 'variable' });
  });

  it('falls back to plain text for unknown languages', () => {
    expect(tokenize('a + b', 'nope')).toEqual(['a + b']);
    expect(tokenize('a + b', 'plain')).toEqual(['a + b']);
  });
});

describe('layoutCode', () => {
  const base: LayoutOptions = { ...DEFAULT_LAYOUT, padding: 32, fontSize: 16, lineHeight: 1.5, chrome: false };
  const lines = tokensToLines(['abc\n', { type: 'keyword', content: 'return' }, ' 1']);

  it('sizes the image from padding, line count and the longest line, with a minimum width', () => {
    const layout = layoutCode(lines, base, measure);
    // inner padding = 20, line box = 24.
    expect(layout.height).toBe(32 * 2 + 20 * 2 + 24 * 2);
    expect(layout.width).toBe(320);
    const wide = layoutCode(tokensToLines('x'.repeat(100)), base, measure);
    expect(wide.width).toBe(32 * 2 + 20 * 2 + 800);
    expect(wide.clipped).toBe(false);
  });

  it('places segments left to right, coloured from the theme, centred in their line box', () => {
    const theme = findTheme('midnight');
    const ops = layoutCode(lines, base, measure).ops.filter((op) => op.kind === 'text');
    expect(ops).toEqual([
      expect.objectContaining({ text: 'abc', x: 52, y: 52 + 12, color: theme.fg }),
      expect.objectContaining({ text: 'return', x: 52, y: 52 + 36, color: theme.colors.keyword }),
      expect.objectContaining({ text: ' 1', x: 52 + 48, y: 52 + 36, color: theme.fg }),
    ]);
  });

  it('draws a gradient background, a shadowed window and the window bar with dots and title', () => {
    const layout = layoutCode(lines, { ...base, chrome: true, title: '  app.ts\n ', background: 'sunset' }, measure);
    const [bg, win] = layout.ops;
    expect(bg).toMatchObject({ kind: 'fill', x: 0, y: 0, w: layout.width, h: layout.height });
    expect(bg?.kind === 'fill' && bg.fill.type).toBe('linear');
    expect(win).toMatchObject({ kind: 'fill', x: 32, y: 32, shadow: true, fill: { color: findTheme('midnight').bg } });
    expect(layout.ops.filter((op) => op.kind === 'circle')).toHaveLength(3);
    expect(texts(layout.ops)).toContain('app.ts');
    // Bar height is 2.5 × the font size.
    expect(layout.height).toBe(32 * 2 + 40 + 20 * 2 + 24 * 2);
  });

  it('omits the background for transparent images and the shadow for theme backgrounds', () => {
    const transparent = layoutCode(lines, { ...base, background: 'transparent' }, measure);
    expect(transparent.ops[0]).toMatchObject({ kind: 'fill', x: 32, y: 32 });
    const themed = layoutCode(lines, { ...base, background: 'theme', theme: 'paper' }, measure);
    expect(themed.ops[0]).toMatchObject({ kind: 'fill', fill: { type: 'solid', color: '#fbf6e9' } });
    expect(themed.ops[1]).not.toHaveProperty('shadow');
  });

  it('adds right-aligned line numbers in a gutter sized for the largest number', () => {
    const ten = tokensToLines(Array.from({ length: 10 }, (_, i) => `l${i}`).join('\n'));
    const layout = layoutCode(ten, { ...base, lineNumbers: true }, measure);
    const numbers = layout.ops.filter((op) => op.kind === 'text' && op.align === 'right');
    expect(numbers.map((op) => op.kind === 'text' && op.text)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    // Gutter = width of "10" (16) + 1.5 × font size (24).
    const first = layout.ops.find((op) => op.kind === 'text' && op.text === 'l0');
    expect(first).toMatchObject({ x: 52 + 16 + 24 });
  });

  it('caps the width and clips long lines without wrapping', () => {
    const layout = layoutCode(tokensToLines('y'.repeat(1000)), { ...base, maxWidth: 800 }, measure);
    expect(layout.width).toBe(800);
    expect(layout.clipped).toBe(true);
    expect(layout.ops.some((op) => op.kind === 'clip')).toBe(true);
    expect(layout.ops.at(-1)).toEqual({ kind: 'unclip' });
  });

  it('clamps out-of-range and non-numeric options', () => {
    const layout = layoutCode(lines, { ...base, fontSize: Number.NaN, lineHeight: 99, padding: -5 }, measure);
    const text = layout.ops.find((op) => op.kind === 'text');
    expect(text?.kind === 'text' && text.font).toMatch(/^14px ui-monospace/);
    expect(layout.ops.find((op) => op.kind === 'fill')).toMatchObject({ x: 0, y: 0, radius: 0 });
  });

  it('works with every theme and background', () => {
    for (const theme of THEMES)
      for (const bg of BACKGROUNDS) {
        const layout = layoutCode(lines, { ...base, theme: theme.id, background: bg.id }, measure);
        expect(layout.ops.length).toBeGreaterThan(2);
      }
  });
});

describe('fitScale', () => {
  it('keeps the requested scale when the canvas fits', () => {
    expect(fitScale(800, 600, 2)).toBe(2);
    expect(fitScale(800, 600, 3)).toBe(3);
  });

  it('reduces the scale to stay within the side and area limits', () => {
    expect(fitScale(1000, 10_000, 3)).toBeCloseTo(MAX_CANVAS_SIDE / 10_000);
    const s = fitScale(5000, 5000, 3);
    expect(5000 * s * 5000 * s).toBeLessThanOrEqual(MAX_CANVAS_AREA + 1);
  });
});

describe('codeToImage', () => {
  it('lays out plain text', () => {
    expect(texts(codeToImage('hello', measure).ops)).toEqual(['hello']);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => codeToImage(s, measure), {
      malformed: ['\t\t\t', '\r\r\n\n', 'x'.repeat(MAX_CHARS), '\n'.repeat(MAX_LINES - 1)],
    });
    expectRobust((s) => tokensToLines(tokenize(validateCode(s), 'markdown')));
  });
});
