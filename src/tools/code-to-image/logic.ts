// Pure logic for code-to-image: token stream → lines of coloured segments →
// canvas size and draw operations. No DOM here: text width comes from an
// injected `measure` function, so the layout is testable in Node.
import { ToolInputError } from '../types.ts';
import { backgroundFill, findTheme, type BackgroundId, type Fill, type ThemeId, type TokenGroup } from './themes.ts';

export const MAX_LINES = 500;
export const MAX_CHARS = 50_000;
/** Longest title drawn in the window bar. */
export const MAX_TITLE = 80;
/** Canvas limits that every current browser can allocate. */
export const MAX_CANVAS_SIDE = 16_384;
export const MAX_CANVAS_AREA = 50_000_000;

export const FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** Structural subset of Prism's Token, so logic doesn't depend on Prism. */
export interface TokenLike {
  type: string;
  alias?: string | string[] | undefined;
  content: TokenStreamLike;
}
export type TokenStreamLike = string | TokenLike | Array<string | TokenLike>;

export interface Segment {
  text: string;
  /** Colour group from the theme, or 'plain'. */
  type: TokenGroup;
}
export type Line = Segment[];

/** Prism token names (and common aliases) mapped to theme colour groups. */
const TYPE_GROUPS: Record<string, TokenGroup> = {
  comment: 'comment',
  prolog: 'comment',
  doctype: 'comment',
  cdata: 'comment',
  shebang: 'comment',
  keyword: 'keyword',
  atrule: 'keyword',
  rule: 'keyword',
  directive: 'keyword',
  'control-flow': 'keyword',
  module: 'keyword',
  instruction: 'keyword',
  string: 'string',
  char: 'string',
  'attr-value': 'string',
  'template-string': 'string',
  url: 'string',
  'string-property': 'property',
  number: 'number',
  boolean: 'number',
  constant: 'number',
  symbol: 'number',
  unit: 'number',
  hexcode: 'number',
  function: 'function',
  'function-name': 'function',
  'class-name': 'type',
  builtin: 'type',
  namespace: 'type',
  'maybe-class-name': 'type',
  annotation: 'type',
  decorator: 'type',
  operator: 'operator',
  entity: 'operator',
  arrow: 'operator',
  punctuation: 'punctuation',
  property: 'property',
  key: 'property',
  'attr-name': 'property',
  selector: 'tag',
  tag: 'tag',
  variable: 'variable',
  parameter: 'variable',
  regex: 'regex',
  inserted: 'inserted',
  deleted: 'deleted',
  important: 'important',
  bold: 'important',
  title: 'important',
  italic: 'important',
};

/** First known group, looking from the innermost token outwards and at aliases before the type. */
function resolveGroup(stack: readonly TokenLike[]): TokenGroup {
  for (let i = stack.length - 1; i >= 0; i--) {
    const token = stack[i]!;
    const aliases = token.alias === undefined ? [] : Array.isArray(token.alias) ? token.alias : [token.alias];
    for (const name of [...aliases, token.type]) {
      const group = TYPE_GROUPS[name];
      if (group) return group;
    }
  }
  return 'plain';
}

/** Throws a ToolInputError when the snippet is too big to render. */
export function validateCode(code: string): string {
  if (code.length > MAX_CHARS)
    throw new ToolInputError(
      `The snippet has ${code.length.toLocaleString('en')} characters; the maximum is ${MAX_CHARS.toLocaleString('en')}.`,
    );
  let lines = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    if (c === 10 || (c === 13 && code.charCodeAt(i + 1) !== 10)) lines++;
  }
  if (lines > MAX_LINES)
    throw new ToolInputError(
      `The snippet has ${lines} lines; the maximum is ${MAX_LINES}. Trim it to the part to show.`,
    );
  return code;
}

/**
 * Flattens a Prism token stream into lines of segments. Nested tokens inherit
 * their parent's group unless they have their own, multi-line tokens are split
 * at line breaks, tabs expand to the next tab stop and adjacent segments of the
 * same group are merged. Always returns at least one (possibly empty) line.
 */
export function tokensToLines(stream: TokenStreamLike, tabSize = 2): Line[] {
  const lines: Line[] = [[]];
  let column = 0;
  const tab = Math.max(1, Math.min(8, Math.floor(tabSize)));

  const push = (text: string, type: TokenGroup) => {
    if (text === '') return;
    const line = lines[lines.length - 1]!;
    const last = line[line.length - 1];
    if (last && last.type === type) last.text += text;
    else line.push({ text, type });
  };

  const emit = (text: string, type: TokenGroup) => {
    const parts = text.split(/\r\n|\r|\n/);
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push([]);
        column = 0;
      }
      let out = '';
      // Expand tabs by column; strip other control characters, which canvas can't draw.
      for (const ch of part) {
        if (ch === '\t') {
          const spaces = tab - (column % tab);
          out += ' '.repeat(spaces);
          column += spaces;
        } else if (ch < ' ' || ch === '\u007f') {
          continue;
        } else {
          out += ch;
          column++;
        }
      }
      push(out, type);
    });
  };

  const walk = (node: TokenStreamLike, stack: TokenLike[]) => {
    if (typeof node === 'string') emit(node, resolveGroup(stack));
    else if (Array.isArray(node)) for (const child of node) walk(child, stack);
    else {
      stack.push(node);
      walk(node.content, stack);
      stack.pop();
    }
  };

  walk(stream, []);
  return lines;
}

export interface LayoutOptions {
  theme: ThemeId;
  background: BackgroundId;
  /** Code font size in CSS pixels. */
  fontSize: number;
  /** Line height as a multiple of the font size. */
  lineHeight: number;
  /** Space between the image edge and the window, in CSS pixels. */
  padding: number;
  lineNumbers: boolean;
  /** Window bar with three dots and an optional title. */
  chrome: boolean;
  title: string;
  /** Widest image in CSS pixels; longer lines are cut off at the edge. */
  maxWidth: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  theme: 'midnight',
  background: 'ocean',
  fontSize: 14,
  lineHeight: 1.5,
  padding: 48,
  lineNumbers: false,
  chrome: true,
  title: '',
  maxWidth: 1600,
};

export const MIN_WIDTH = 320;

export type DrawOp =
  | { kind: 'fill'; x: number; y: number; w: number; h: number; radius: number; fill: Fill; shadow?: boolean }
  | { kind: 'circle'; x: number; y: number; r: number; color: string }
  | {
      kind: 'text';
      x: number;
      /** Vertical centre of the line box; draw with textBaseline = 'middle'. */
      y: number;
      text: string;
      color: string;
      align: 'left' | 'right' | 'center';
      font: string;
    }
  | { kind: 'clip'; x: number; y: number; w: number; h: number }
  | { kind: 'unclip' };

export interface Layout {
  /** Image size in CSS pixels (multiply by the scale for the canvas size). */
  width: number;
  height: number;
  ops: DrawOp[];
  /** True when some lines were cut off by the maximum width. */
  clipped: boolean;
}

export type Measure = (text: string) => number;

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function codeFont(fontSize: number): string {
  return `${fontSize}px ${FONT_STACK}`;
}

/**
 * Computes the image size and the draw operations, in order. `measure` must
 * return the width of a string in the code font at `options.fontSize`.
 */
export function layoutCode(lines: readonly Line[], options: LayoutOptions, measure: Measure): Layout {
  const theme = findTheme(options.theme);
  const fontSize = Math.round(clamp(options.fontSize, 8, 48, DEFAULT_LAYOUT.fontSize));
  const lineBox = Math.round(fontSize * clamp(options.lineHeight, 1, 3, DEFAULT_LAYOUT.lineHeight));
  const padding = Math.round(clamp(options.padding, 0, 256, DEFAULT_LAYOUT.padding));
  const maxWidth = Math.round(clamp(options.maxWidth, MIN_WIDTH, 8192, DEFAULT_LAYOUT.maxWidth));
  const font = codeFont(fontSize);
  const inner = Math.round(fontSize * 1.25);
  const barHeight = options.chrome ? Math.round(fontSize * 2.5) : 0;
  const titleChars = [...options.title.slice(0, MAX_TITLE * 4)].map((ch) => (ch < ' ' || ch === '\u007f' ? ' ' : ch));
  const title = [...titleChars.join('').trim()].slice(0, MAX_TITLE).join('');

  const gutter = options.lineNumbers ? Math.ceil(measure(String(lines.length))) + Math.round(fontSize * 1.5) : 0;
  const lineWidths = lines.map((line) => line.reduce((w, s) => w + measure(s.text), 0));
  const codeWidth = Math.ceil(Math.max(0, ...lineWidths));
  const natural = padding * 2 + inner * 2 + gutter + codeWidth;
  const width = Math.max(MIN_WIDTH, Math.min(maxWidth, natural));
  const windowW = width - padding * 2;
  const windowH = barHeight + inner * 2 + lineBox * Math.max(1, lines.length);
  const height = padding * 2 + windowH;
  const radius = padding > 0 ? Math.round(fontSize * 0.75) : 0;

  const ops: DrawOp[] = [];
  const bg = backgroundFill(options.background, theme);
  if (bg) ops.push({ kind: 'fill', x: 0, y: 0, w: width, h: height, radius: 0, fill: bg });
  ops.push({
    kind: 'fill',
    x: padding,
    y: padding,
    w: windowW,
    h: windowH,
    radius,
    fill: { type: 'solid', color: theme.bg },
    ...(padding > 0 && options.background !== 'theme' && options.background !== 'transparent' ? { shadow: true } : {}),
  });

  if (options.chrome) {
    const r = Math.max(3, Math.round(fontSize * 0.42));
    const cy = padding + barHeight / 2;
    const gap = r * 3.2;
    const first = padding + inner + r;
    theme.dots.forEach((color, i) => ops.push({ kind: 'circle', x: first + i * gap, y: cy, r, color }));
    if (title)
      ops.push({
        kind: 'text',
        x: padding + windowW / 2,
        y: cy,
        text: title,
        color: theme.title,
        align: 'center',
        font: codeFont(Math.max(8, Math.round(fontSize * 0.9))),
      });
  }

  const top = padding + barHeight + inner;
  const left = padding + inner;
  const clipped = natural > width;
  const codeLeft = left + gutter;
  if (clipped) ops.push({ kind: 'clip', x: padding, y: padding, w: windowW, h: windowH });
  lines.forEach((line, i) => {
    const y = top + i * lineBox + lineBox / 2;
    if (options.lineNumbers)
      ops.push({
        kind: 'text',
        x: left + gutter - Math.round(fontSize * 1.5),
        y,
        text: String(i + 1),
        color: theme.lineNumber,
        align: 'right',
        font,
      });
    let x = codeLeft;
    for (const seg of line) {
      const w = measure(seg.text);
      if (x < width && seg.text.trim() !== '')
        ops.push({
          kind: 'text',
          x,
          y,
          text: seg.text,
          color: theme.colors[seg.type] ?? theme.fg,
          align: 'left',
          font,
        });
      x += w;
    }
  });
  if (clipped) ops.push({ kind: 'unclip' });

  return { width, height, ops, clipped };
}

/**
 * Largest scale up to `requested` at which a canvas of `width` × `height` CSS
 * pixels stays within the browser limits. May be below 1 for huge images.
 */
export function fitScale(width: number, height: number, requested: number): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const limit = Math.min(MAX_CANVAS_SIDE / w, MAX_CANVAS_SIDE / h, Math.sqrt(MAX_CANVAS_AREA / (w * h)));
  return Math.min(Math.max(1, requested), limit);
}

/** Convenience for tests and the robustness check: plain text straight to a layout. */
export function codeToImage(code: string, measure: Measure, options: LayoutOptions = DEFAULT_LAYOUT): Layout {
  return layoutCode(tokensToLines(validateCode(code)), options, measure);
}
