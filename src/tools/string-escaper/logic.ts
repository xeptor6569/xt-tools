import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export type EscapeMode =
  'json' | 'js' | 'c' | 'sql' | 'shell' | 'powershell' | 'regex' | 'csv' | 'xml-text' | 'xml-attr';
export type Direction = 'escape' | 'unescape';
export type JsQuote = "'" | '"' | '`';

export interface EscapeOptions {
  mode: EscapeMode;
  direction: Direction;
  /** JavaScript only: the quote the string will sit in. */
  quote: JsQuote;
  /** JavaScript only: write astral characters as \u{1F680} instead of a surrogate pair. */
  codePointEscapes: boolean;
  /** JSON, JavaScript, C/Java: escape everything outside printable ASCII. */
  asciiOnly: boolean;
  /** JSON, JavaScript, C/Java, SQL: add the surrounding quotes. */
  wrap: boolean;
  /** SQL only: MySQL-style backslash escapes. */
  mysql: boolean;
  /** CSV only: quote the field even when it doesn't need it. */
  alwaysQuote: boolean;
}

export const DEFAULT_OPTIONS: EscapeOptions = {
  mode: 'json',
  direction: 'escape',
  quote: "'",
  codePointEscapes: false,
  asciiOnly: false,
  wrap: false,
  mysql: false,
  alwaysQuote: false,
};

export const MODES: ReadonlyArray<{ value: EscapeMode; label: string }> = [
  { value: 'json', label: 'JSON string' },
  { value: 'js', label: 'JavaScript string' },
  { value: 'c', label: 'C / Java string' },
  { value: 'sql', label: 'SQL string literal' },
  { value: 'shell', label: 'POSIX shell (sh, bash, zsh)' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'regex', label: 'Regular expression' },
  { value: 'csv', label: 'CSV field (RFC 4180)' },
  { value: 'xml-text', label: 'XML / HTML text' },
  { value: 'xml-attr', label: 'XML / HTML attribute' },
];

// ---------------------------------------------------------------- helpers

const hex = (n: number, width: number) => n.toString(16).toUpperCase().padStart(width, '0');
const u4 = (unit: number) => `\\u${hex(unit, 4)}`;
const isSurrogate = (cp: number) => cp >= 0xd800 && cp <= 0xdfff;

/** \uXXXX for a BMP code point, or a surrogate pair for an astral one. */
function utf16Escape(cp: number): string {
  if (cp <= 0xffff) return u4(cp);
  const v = cp - 0x10000;
  return u4(0xd800 + (v >> 10)) + u4(0xdc00 + (v & 0x3ff));
}

/** Calls `fn` for each code point (lone surrogates come through on their own). */
function mapCodePoints(input: string, fn: (ch: string, cp: number, next: string) => string): string {
  const out: string[] = [];
  for (let i = 0; i < input.length;) {
    const cp = input.codePointAt(i)!;
    const len = cp > 0xffff ? 2 : 1;
    const ch = input.slice(i, i + len);
    i += len;
    out.push(fn(ch, cp, input[i] ?? ''));
  }
  return out.join('');
}

const pos = (i: number) => `at position ${i + 1}`;
function fail(message: string): never {
  throw new ToolInputError(message);
}

function readHex(s: string, i: number, n: number, what: string): number {
  const digits = s.slice(i, i + n);
  if (digits.length !== n || !/^[0-9a-fA-F]+$/.test(digits)) {
    fail(`${what} ${pos(i - 2)} needs exactly ${n} hex digits.`);
  }
  return parseInt(digits, 16);
}

/** Reads `{hex}` after \u, returning the code point and the index after `}`. */
function readBracedCodePoint(s: string, i: number, at: number): [number, number] {
  const end = s.indexOf('}', i);
  const digits = end === -1 ? '' : s.slice(i + 1, end);
  if (end === -1 || !/^[0-9a-fA-F]{1,8}$/.test(digits)) fail(`Bad \\u{…} escape ${pos(at)}.`);
  const cp = parseInt(digits, 16);
  if (cp > 0x10ffff) fail(`\\u{${digits}} ${pos(at)} is beyond U+10FFFF.`);
  return [cp, end + 1];
}

const fromUnit = (cp: number) => (cp <= 0xffff ? String.fromCharCode(cp) : String.fromCodePoint(cp));

/** Removes surrounding quotes when the whole (trimmed) input is one quoted literal. */
function unwrap(input: string, quotes: string): string {
  const t = input.trim();
  if (t.length < 2 || !quotes.includes(t[0]!) || t.at(-1) !== t[0]) return input;
  let backslashes = 0;
  for (let i = t.length - 2; i >= 1 && t[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 0 ? t.slice(1, -1) : input;
}

// ---------------------------------------------------------------- escape

const CONTROL_NAMES: Record<string, string> = { '\b': 'b', '\f': 'f', '\n': 'n', '\r': 'r', '\t': 't' };

function escapeJson(input: string, o: EscapeOptions): string {
  const body = mapCodePoints(input, (ch, cp) => {
    if (ch === '"' || ch === '\\') return `\\${ch}`;
    if (CONTROL_NAMES[ch]) return `\\${CONTROL_NAMES[ch]}`;
    if (cp < 0x20 || isSurrogate(cp)) return u4(cp);
    if (o.asciiOnly && cp > 0x7e) return utf16Escape(cp);
    return ch;
  });
  return o.wrap ? `"${body}"` : body;
}

function escapeJs(input: string, o: EscapeOptions): string {
  const q = o.quote;
  const body = mapCodePoints(input, (ch, cp, next) => {
    if (ch === '\\' || ch === q) return `\\${ch}`;
    if (q === '`' && ch === '$' && next === '{') return '\\$';
    if (CONTROL_NAMES[ch]) return `\\${CONTROL_NAMES[ch]}`;
    if (ch === '\v') return '\\v';
    if (ch === '\0') return /[0-9]/.test(next) ? '\\x00' : '\\0';
    if (cp < 0x20 || cp === 0x7f) return `\\x${hex(cp, 2)}`;
    if (cp === 0x2028 || cp === 0x2029 || isSurrogate(cp)) return u4(cp);
    if (o.asciiOnly && cp > 0x7e) {
      if (cp <= 0xff) return `\\x${hex(cp, 2)}`;
      if (cp > 0xffff && o.codePointEscapes) return `\\u{${hex(cp, 1)}}`;
      return utf16Escape(cp);
    }
    return ch;
  });
  return o.wrap ? `${q}${body}${q}` : body;
}

function escapeC(input: string, o: EscapeOptions): string {
  const body = mapCodePoints(input, (ch, cp) => {
    if (ch === '"' || ch === '\\') return `\\${ch}`;
    if (CONTROL_NAMES[ch]) return `\\${CONTROL_NAMES[ch]}`;
    // Three-digit octal works in both C and Java and never swallows the next character.
    if (cp < 0x20 || cp === 0x7f) return `\\${cp.toString(8).padStart(3, '0')}`;
    if (isSurrogate(cp)) return u4(cp);
    if (o.asciiOnly && cp > 0x7e) return utf16Escape(cp);
    return ch;
  });
  return o.wrap ? `"${body}"` : body;
}

const MYSQL_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '"': '\\"',
  '\0': '\\0',
  '\n': '\\n',
  '\r': '\\r',
  '\x1a': '\\Z',
};

function escapeSql(input: string, o: EscapeOptions): string {
  const body = o.mysql
    ? input.replace(/[\\'"\n\r]|\p{Cc}/gu, (c) => MYSQL_ESCAPES[c] ?? c)
    : input.replaceAll("'", "''");
  return o.wrap ? `'${body}'` : body;
}

function escapeCsv(input: string, o: EscapeOptions): string {
  return o.alwaysQuote || /[",\r\n]/.test(input) ? `"${input.replaceAll('"', '""')}"` : input;
}

function escapeXml(input: string, attribute: boolean): string {
  return mapCodePoints(input, (ch, cp) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '\r') return '&#13;';
    if (attribute) {
      if (ch === '"') return '&quot;';
      if (ch === "'") return '&#39;';
      if (ch === '\n') return '&#10;';
      if (ch === '\t') return '&#9;';
    }
    if ((cp < 0x20 && ch !== '\n' && ch !== '\t') || cp === 0xfffe || cp === 0xffff) {
      fail(`U+${hex(cp, 4)} can’t appear in XML 1.0, not even as a character reference.`);
    }
    if (isSurrogate(cp)) fail(`A lone surrogate (U+${hex(cp, 4)}) can’t be represented in XML.`);
    return ch;
  });
}

// ---------------------------------------------------------------- unescape

const SIMPLE_JSON: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

function unescapeJson(input: string): string {
  const s = unwrap(input, '"');
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== '\\') {
      out.push(c);
      continue;
    }
    const e = s[i + 1];
    if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
    if (e === 'u') {
      out.push(String.fromCharCode(readHex(s, i + 2, 4, 'The \\u escape')));
      i += 5;
    } else if (SIMPLE_JSON[e!] !== undefined) {
      out.push(SIMPLE_JSON[e!]!);
      i++;
    } else fail(`\\${e} ${pos(i)} is not a JSON escape. JSON allows \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX.`);
  }
  return out.join('');
}

const SIMPLE_JS: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

function unescapeJs(input: string): string {
  const s = unwrap(input, '\'"`');
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== '\\') {
      out.push(c);
      continue;
    }
    const e = s[i + 1];
    if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
    const at = i;
    i++;
    if (SIMPLE_JS[e!] !== undefined) out.push(SIMPLE_JS[e!]!);
    else if (e === '0' && !/[0-9]/.test(s[i + 1] ?? '')) out.push('\0');
    else if (/[0-9]/.test(e!))
      fail(`Octal escapes like \\${e} (${pos(at)}) aren’t allowed in modern JavaScript; use \\x or \\u.`);
    else if (e === 'x') {
      out.push(String.fromCharCode(readHex(s, i + 1, 2, 'The \\x escape')));
      i += 2;
    } else if (e === 'u') {
      if (s[i + 1] === '{') {
        const [cp, next] = readBracedCodePoint(s, i + 1, at);
        out.push(fromUnit(cp));
        i = next - 1;
      } else {
        out.push(String.fromCharCode(readHex(s, i + 1, 4, 'The \\u escape')));
        i += 4;
      }
    } else if (e === '\r') {
      if (s[i + 1] === '\n') i++; // line continuation
    } else if (e === '\n' || e === '\u2028' || e === '\u2029') {
      // line continuation: nothing
    } else out.push(e!); // \' \" \\ \` \$ and other identity escapes
  }
  return out.join('');
}

const SIMPLE_C: Record<string, string> = {
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  s: ' ',
  '\\': '\\',
  "'": "'",
  '"': '"',
  '?': '?',
};

function unescapeC(input: string): string {
  const s = unwrap(input, '"');
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== '\\') {
      out.push(c);
      continue;
    }
    const e = s[i + 1];
    if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
    const at = i;
    i++;
    if (SIMPLE_C[e!] !== undefined) out.push(SIMPLE_C[e!]!);
    else if (/[0-7]/.test(e!)) {
      const digits = /^[0-7]{1,3}/.exec(s.slice(i, i + 3))![0];
      const v = parseInt(digits, 8);
      if (v > 0xff) fail(`The octal escape \\${digits} ${pos(at)} is above \\377.`);
      out.push(String.fromCharCode(v));
      i += digits.length - 1;
    } else if (e === 'x') {
      const digits = /^[0-9a-fA-F]*/.exec(s.slice(i + 1, i + 9))![0];
      if (digits === '') fail(`\\x ${pos(at)} needs at least one hex digit.`);
      const v = parseInt(digits, 16);
      if (v > 0x10ffff) fail(`\\x${digits} ${pos(at)} is beyond U+10FFFF.`);
      out.push(fromUnit(v));
      i += digits.length;
    } else if (e === 'u') {
      out.push(String.fromCharCode(readHex(s, i + 1, 4, 'The \\u escape')));
      i += 4;
    } else if (e === 'U') {
      const v = readHex(s, i + 1, 8, 'The \\U escape');
      if (v > 0x10ffff) fail(`\\U${s.slice(i + 1, i + 9)} ${pos(at)} is beyond U+10FFFF.`);
      out.push(fromUnit(v));
      i += 8;
    } else fail(`\\${e} ${pos(at)} is not a C or Java escape.`);
  }
  return out.join('');
}

function unescapeSql(input: string, mysql: boolean): string {
  const s = unwrap(input, "'");
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "'") {
      if (s[i + 1] !== "'") fail(`The quote ${pos(i)} isn’t doubled; inside a SQL string write '' for one quote.`);
      out.push("'");
      i++;
    } else if (c === '\\' && mysql) {
      const e = s[i + 1];
      if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
      const map: Record<string, string> = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' };
      // MySQL keeps the backslash in \% and \_ (they matter to LIKE) and drops it elsewhere.
      out.push(e === '%' || e === '_' ? `\\${e}` : (map[e!] ?? e!));
      i++;
    } else out.push(c);
  }
  return out.join('');
}

const SHELL_OPERATORS = '|&;<>()`';
const ANSI_C: Record<string, string> = {
  a: '\x07',
  b: '\b',
  e: '\x1b',
  E: '\x1b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '\\': '\\',
  "'": "'",
  '"': '"',
  '?': '?',
};

function checkExpansion(s: string, i: number) {
  if (/^\$[A-Za-z_{(0-9@*#?$!-]/.test(s.slice(i, i + 2))) {
    fail(`“${s.slice(i, i + 2)}…” ${pos(i)} would be expanded by the shell, so this isn’t a plain string.`);
  }
}

/** Decodes $'…' (ANSI-C quoting, bash/zsh/ksh and POSIX 2024). Returns the index after the closing quote. */
function readAnsiC(s: string, start: number, out: string[]): number {
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (c === "'") return i + 1;
    if (c !== '\\') {
      out.push(c);
      continue;
    }
    const e = s[i + 1];
    if (e === undefined) break;
    i++;
    if (ANSI_C[e] !== undefined) out.push(ANSI_C[e]);
    else if (/[0-7]/.test(e)) {
      const digits = /^[0-7]{1,3}/.exec(s.slice(i, i + 3))![0];
      out.push(String.fromCharCode(parseInt(digits, 8) & 0xff));
      i += digits.length - 1;
    } else if (e === 'x' || e === 'u' || e === 'U') {
      const max = e === 'x' ? 2 : e === 'u' ? 4 : 8;
      const digits = new RegExp(`^[0-9a-fA-F]{1,${max}}`).exec(s.slice(i + 1, i + 1 + max))?.[0] ?? '';
      if (digits === '') out.push(`\\${e}`);
      else {
        const v = parseInt(digits, 16);
        if (v > 0x10ffff) fail(`\\${e}${digits} ${pos(i - 1)} is beyond U+10FFFF.`);
        out.push(fromUnit(v));
        i += digits.length;
      }
    } else if (e === 'c' && s[i + 1] !== undefined) {
      out.push(String.fromCharCode(s.charCodeAt(i + 1) & 0x1f));
      i++;
    } else out.push(`\\${e}`);
  }
  return fail(`The $'…' string starting ${pos(start - 2)} is never closed.`);
}

function unescapeShell(input: string): string {
  const s = input.trim();
  const out: string[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end === -1) fail(`The single quote ${pos(i)} is never closed.`);
      out.push(s.slice(i + 1, end));
      i = end + 1;
    } else if (c === '$' && s[i + 1] === "'") {
      i = readAnsiC(s, i + 2, out);
    } else if (c === '"') {
      let j = i + 1;
      for (; j < s.length && s[j] !== '"'; j++) {
        const d = s[j]!;
        if (d === '\\') {
          const e = s[j + 1];
          if (e === '\n') j++;
          else if (e !== undefined && '$`"\\'.includes(e)) {
            out.push(e);
            j++;
          } else out.push('\\');
        } else if (d === '`') fail(`The backtick ${pos(j)} runs a command inside double quotes.`);
        else {
          if (d === '$') checkExpansion(s, j);
          out.push(d);
        }
      }
      if (j >= s.length) fail(`The double quote ${pos(i)} is never closed.`);
      i = j + 1;
    } else if (c === '\\') {
      const e = s[i + 1];
      if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
      if (e !== '\n') out.push(e!);
      i += 2;
    } else if (/\s/.test(c)) {
      fail(`Unquoted whitespace ${pos(i)} splits this into several shell words. Quote it or escape it with \\.`);
    } else if (SHELL_OPERATORS.includes(c)) {
      fail(`Unquoted “${c}” ${pos(i)} is shell syntax, not part of a string. Quote it or escape it with \\.`);
    } else {
      if (c === '$') checkExpansion(s, i);
      out.push(c);
      i++;
    }
  }
  return out.join('');
}

const PS_SINGLE = "'\u2018\u2019\u201A\u201B";
const PS_DOUBLE = '"\u201C\u201D\u201E';
const PS_BACKTICK: Record<string, string> = {
  '0': '\0',
  a: '\x07',
  b: '\b',
  e: '\x1b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

function unescapePowerShell(input: string): string {
  const t = input.trim();
  const out: string[] = [];
  const double = t.length >= 2 && PS_DOUBLE.includes(t[0]!) && PS_DOUBLE.includes(t.at(-1)!);
  const single = !double && t.length >= 2 && PS_SINGLE.includes(t[0]!) && PS_SINGLE.includes(t.at(-1)!);
  const s = double || single ? t.slice(1, -1) : input;
  const quotes = double ? PS_DOUBLE : PS_SINGLE;
  const offset = double || single ? 1 : 0;

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quotes.includes(c)) {
      if (!quotes.includes(s[i + 1] ?? '')) {
        fail(`The quote ${pos(i + offset)} isn’t doubled; inside a PowerShell string write it twice.`);
      }
      out.push(c);
      i++;
    } else if (double && c === '`') {
      const e = s[i + 1];
      if (e === undefined) fail(`The backtick ${pos(i + offset)} has nothing to escape.`);
      if (e === 'u' && s[i + 2] === '{') {
        const [cp, next] = readBracedCodePoint(s, i + 2, i + offset);
        out.push(fromUnit(cp));
        i = next - 1;
      } else {
        out.push(PS_BACKTICK[e!] ?? e!);
        i++;
      }
    } else if (double && c === '$' && /[A-Za-z_{(?:$^]/.test(s[i + 1] ?? '')) {
      fail(`“$${s[i + 1]!}” ${pos(i + offset)} would be expanded by PowerShell, so this isn’t a plain string.`);
    } else out.push(c);
  }
  return out.join('');
}

const REGEX_SYNTAX = '^$\\.*+?()[]{}|/';
const REGEX_CONTROL: Record<string, string> = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v' };

function unescapeRegex(input: string): string {
  const out: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c !== '\\') {
      if (REGEX_SYNTAX.includes(c) && c !== '/') {
        fail(`Unescaped “${c}” ${pos(i)} is regular-expression syntax, so this pattern isn’t a plain literal.`);
      }
      out.push(c);
      continue;
    }
    const e = input[i + 1];
    if (e === undefined) fail(`The backslash ${pos(i)} has nothing to escape.`);
    const at = i;
    i++;
    if (REGEX_SYNTAX.includes(e!) || e === '-') out.push(e!);
    else if (REGEX_CONTROL[e!] !== undefined) out.push(REGEX_CONTROL[e!]!);
    else if (e === '0' && !/[0-9]/.test(input[i + 1] ?? '')) out.push('\0');
    else if (e === 'x') {
      out.push(String.fromCharCode(readHex(input, i + 1, 2, 'The \\x escape')));
      i += 2;
    } else if (e === 'u') {
      if (input[i + 1] === '{') {
        const [cp, next] = readBracedCodePoint(input, i + 1, at);
        out.push(fromUnit(cp));
        i = next - 1;
      } else {
        out.push(String.fromCharCode(readHex(input, i + 1, 4, 'The \\u escape')));
        i += 4;
      }
    } else if (e === 'c' && /[A-Za-z]/.test(input[i + 1] ?? '')) {
      out.push(String.fromCharCode(input.charCodeAt(i + 1) & 0x1f));
      i++;
    } else if ('dDwWsSbB'.includes(e!)) {
      fail(`\\${e} ${pos(at)} is a character class or assertion, not a literal character.`);
    } else if (/[0-9k]/.test(e!)) fail(`\\${e} ${pos(at)} is a back-reference, not a literal character.`);
    else if (/[A-Za-z]/.test(e!)) fail(`\\${e} ${pos(at)} is not a literal escape.`);
    else out.push(e!); // identity escapes of punctuation, e.g. \@ or \ (space)
  }
  return out.join('');
}

function unescapeCsv(input: string): string {
  const s = input.replace(/\r?\n$/, '');
  if (!s.startsWith('"')) {
    if (s.includes('"')) fail('A field with quotes in it must itself be quoted ("…") with each quote doubled.');
    if (s.includes(',')) fail('An unquoted comma separates fields; this is more than one CSV field.');
    if (/[\r\n]/.test(s)) fail('An unquoted line break ends the record; quote fields that contain line breaks.');
    return s;
  }
  if (s.length < 2 || !s.endsWith('"')) fail('The quoted field is never closed.');
  const inner = s.slice(1, -1);
  const lone = /(?:^|[^"])(?:"")*"(?!")/.exec(inner);
  if (lone) fail(`The quote ${pos(lone.index + lone[0].length)} inside a quoted field must be doubled ("").`);
  return inner.replaceAll('""', '"');
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  shy: '\u00AD',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  para: '¶',
  sect: '§',
  iexcl: '¡',
  iquest: '¿',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  hearts: '♥',
  zwj: '\u200D',
  zwnj: '\u200C',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
};

function unescapeXml(input: string): string {
  return input.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (match, ref: string, offset: number) => {
    if (ref.startsWith('#')) {
      const digits = ref[1] === 'x' || ref[1] === 'X' ? ref.slice(2) : ref.slice(1);
      const cp = digits.length > 8 ? Infinity : parseInt(digits, ref.length - digits.length === 2 ? 16 : 10);
      if (cp === 0 || cp > 0x10ffff || isSurrogate(cp))
        fail(`${match.slice(0, 20)} ${pos(offset)} is not a valid character.`);
      return String.fromCodePoint(cp);
    }
    const value = ENTITIES[ref];
    if (value === undefined) {
      fail(
        `Unknown entity &${ref.slice(0, 20)}; ${pos(offset)}. Only the XML entities and common HTML ones are known.`,
      );
    }
    return value!;
  });
}

// ---------------------------------------------------------------- entry point

/** Escapes or unescapes `input` for the chosen syntax. */
export function stringEscaper(input: string, options: Partial<EscapeOptions> = {}): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (o.direction === 'escape') {
    switch (o.mode) {
      case 'json':
        return escapeJson(input, o);
      case 'js':
        return escapeJs(input, o);
      case 'c':
        return escapeC(input, o);
      case 'sql':
        return escapeSql(input, o);
      case 'shell':
        return `'${input.replaceAll("'", "'\\''")}'`;
      case 'powershell':
        return `'${input.replace(/['\u2018\u2019\u201A\u201B]/g, '$&$&')}'`;
      case 'regex':
        return input.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
      case 'csv':
        return escapeCsv(input, o);
      case 'xml-text':
        return escapeXml(input, false);
      case 'xml-attr':
        return escapeXml(input, true);
    }
  }
  switch (o.mode) {
    case 'json':
      return unescapeJson(input);
    case 'js':
      return unescapeJs(input);
    case 'c':
      return unescapeC(input);
    case 'sql':
      return unescapeSql(input, o.mysql);
    case 'shell':
      return unescapeShell(input);
    case 'powershell':
      return unescapePowerShell(input);
    case 'regex':
      return unescapeRegex(input);
    case 'csv':
      return unescapeCsv(input);
    case 'xml-text':
    case 'xml-attr':
      return unescapeXml(input);
  }
}
