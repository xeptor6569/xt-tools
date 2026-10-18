import { ToolInputError } from '../types.ts';

export interface Group {
  name: string;
  value: string | undefined;
}

export interface Match {
  index: number;
  end: number;
  text: string;
  groups: Group[];
}

export interface RegexResult {
  matches: Match[];
  truncated: boolean;
  replaced: string | undefined;
}

export interface Segment {
  text: string;
  /** Index into `matches`, or -1 for text between matches. */
  match: number;
}

const MAX_TEXT = 1_000_000;
const MAX_PATTERN = 10_000;
export const MAX_MATCHES = 1000;
const VALID_FLAGS = /^[dgimsuvy]*$/;

export function compile(pattern: string, flags: string): RegExp {
  if (pattern.length > MAX_PATTERN) throw new ToolInputError('The pattern is too long.');
  if (!VALID_FLAGS.test(flags)) throw new ToolInputError('Flags can only be d, g, i, m, s, u, v and y.');
  if (new Set(flags).size !== flags.length) throw new ToolInputError('Each flag can only be used once.');
  if (flags.includes('u') && flags.includes('v')) throw new ToolInputError('The u and v flags can’t be combined.');
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new ToolInputError((error as Error).message.replace(/^Invalid regular expression: /, 'Invalid pattern: '));
  }
}

/**
 * Runs `pattern` over `text`. Runs in a Web Worker in the UI, which is
 * terminated if a catastrophic pattern takes too long.
 */
export function regexTest(pattern: string, flags: string, text: string, replacement?: string): RegexResult {
  if (text.length > MAX_TEXT) throw new ToolInputError('The test text is too large (maximum 1 MB).');
  if (pattern === '') return { matches: [], truncated: false, replaced: undefined };
  const re = compile(pattern, flags);
  const names = Object.keys(new RegExp(`${pattern}|`, flags.replace(/[gy]/g, '')).exec('')?.groups ?? {});

  const matches: Match[] = [];
  let truncated = false;
  const toMatch = (m: RegExpExecArray): Match => {
    const numbered = m.slice(1).map((value, i) => ({ name: String(i + 1), value }));
    const named = names.map((name) => ({ name, value: m.groups?.[name] }));
    return { index: m.index, end: m.index + m[0].length, text: m[0], groups: [...numbered, ...named] };
  };

  if (re.global || re.sticky) {
    const scan = re.global ? re : new RegExp(re.source, `${re.flags}g`);
    for (const m of text.matchAll(scan)) {
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      matches.push(toMatch(m));
      if (re.sticky && !re.global) break;
    }
  } else {
    const m = re.exec(text);
    if (m) matches.push(toMatch(m));
  }

  const replaced = replacement === undefined ? undefined : text.replace(compile(pattern, flags), replacement);
  return { matches, truncated, replaced };
}

/** Splits `text` into alternating plain and matched pieces for highlighting. */
export function segments(text: string, matches: readonly Match[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: -1 });
    if (m.end > m.index) out.push({ text: text.slice(m.index, m.end), match: i });
    pos = Math.max(pos, m.end);
  });
  if (pos < text.length) out.push({ text: text.slice(pos), match: -1 });
  return out;
}
