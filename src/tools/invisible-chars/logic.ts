import { ToolInputError } from '../types.ts';

export type Kind = 'invisible' | 'bidi' | 'space' | 'homoglyph' | 'control';

export interface Finding {
  index: number;
  line: number;
  column: number;
  char: string;
  codePoint: string;
  name: string;
  kind: Kind;
  /** What it would be replaced with when cleaning ('' = removed). */
  replacement: string;
}

export interface ScanResult {
  findings: Finding[];
  cleaned: string;
  truncated: boolean;
}

const MAX_INPUT = 2_000_000;
const MAX_FINDINGS = 2000;

const NAMED: Record<number, [string, Kind, string]> = {
  0x00ad: ['Soft hyphen', 'invisible', ''],
  0x034f: ['Combining grapheme joiner', 'invisible', ''],
  0x061c: ['Arabic letter mark', 'bidi', ''],
  0x115f: ['Hangul choseong filler', 'invisible', ''],
  0x1160: ['Hangul jungseong filler', 'invisible', ''],
  0x17b4: ['Khmer vowel inherent AQ', 'invisible', ''],
  0x180e: ['Mongolian vowel separator', 'invisible', ''],
  0x200b: ['Zero width space', 'invisible', ''],
  0x200c: ['Zero width non-joiner', 'invisible', ''],
  0x200d: ['Zero width joiner', 'invisible', ''],
  0x200e: ['Left-to-right mark', 'bidi', ''],
  0x200f: ['Right-to-left mark', 'bidi', ''],
  0x202a: ['Left-to-right embedding', 'bidi', ''],
  0x202b: ['Right-to-left embedding', 'bidi', ''],
  0x202c: ['Pop directional formatting', 'bidi', ''],
  0x202d: ['Left-to-right override', 'bidi', ''],
  0x202e: ['Right-to-left override', 'bidi', ''],
  0x2060: ['Word joiner', 'invisible', ''],
  0x2061: ['Function application', 'invisible', ''],
  0x2062: ['Invisible times', 'invisible', ''],
  0x2063: ['Invisible separator', 'invisible', ''],
  0x2064: ['Invisible plus', 'invisible', ''],
  0x2066: ['Left-to-right isolate', 'bidi', ''],
  0x2067: ['Right-to-left isolate', 'bidi', ''],
  0x2068: ['First strong isolate', 'bidi', ''],
  0x2069: ['Pop directional isolate', 'bidi', ''],
  0x3164: ['Hangul filler', 'invisible', ''],
  0xfeff: ['Zero width no-break space (BOM)', 'invisible', ''],
  0xffa0: ['Halfwidth Hangul filler', 'invisible', ''],
  0x00a0: ['No-break space', 'space', ' '],
  0x1680: ['Ogham space mark', 'space', ' '],
  0x2000: ['En quad', 'space', ' '],
  0x2001: ['Em quad', 'space', ' '],
  0x2002: ['En space', 'space', ' '],
  0x2003: ['Em space', 'space', ' '],
  0x2004: ['Three-per-em space', 'space', ' '],
  0x2005: ['Four-per-em space', 'space', ' '],
  0x2006: ['Six-per-em space', 'space', ' '],
  0x2007: ['Figure space', 'space', ' '],
  0x2008: ['Punctuation space', 'space', ' '],
  0x2009: ['Thin space', 'space', ' '],
  0x200a: ['Hair space', 'space', ' '],
  0x2028: ['Line separator', 'space', '\n'],
  0x2029: ['Paragraph separator', 'space', '\n'],
  0x202f: ['Narrow no-break space', 'space', ' '],
  0x205f: ['Medium mathematical space', 'space', ' '],
  0x3000: ['Ideographic space', 'space', ' '],
};

// Letters from other scripts that look like Latin letters.
const CONFUSABLES: Record<string, string> = {
  а: 'a',
  в: 'B',
  е: 'e',
  к: 'k',
  м: 'M',
  н: 'H',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 'T',
  у: 'y',
  х: 'x',
  ѕ: 's',
  і: 'i',
  ј: 'j',
  ԁ: 'd',
  ԛ: 'q',
  ԝ: 'w',
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  І: 'I',
  Ј: 'J',
  Ѕ: 'S',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
  ο: 'o',
  ν: 'v',
  ρ: 'p',
  ι: 'i',
  κ: 'k',
  ɡ: 'g',
  ı: 'i',
  ℓ: 'l',
  '∕': '/',
  '‐': '-',
};

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

/** Finds invisible, bidirectional, unusual space and look-alike characters. */
export function invisibleChars(input: string): ScanResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  const findings: Finding[] = [];
  let cleaned = '';
  let index = 0;
  let line = 1;
  let column = 1;
  let truncated = false;
  const chars = [...input];
  chars.forEach((ch, i) => {
    const cp = ch.codePointAt(0) ?? 0;
    let hit: Omit<Finding, 'index' | 'line' | 'column' | 'char' | 'codePoint'> | undefined;
    const named = NAMED[cp];
    if (named) {
      const [name, kind, replacement] = named;
      // ZWJ inside an emoji sequence is legitimate.
      const emojiJoin =
        cp === 0x200d &&
        /\p{Extended_Pictographic}/u.test(chars[i - 1] ?? '') &&
        /\p{Extended_Pictographic}/u.test(chars[i + 1] ?? '');
      if (!emojiJoin) hit = { name, kind, replacement };
    } else if (CONFUSABLES[ch]) {
      hit = { name: `Looks like Latin "${CONFUSABLES[ch]}"`, kind: 'homoglyph', replacement: CONFUSABLES[ch] };
    } else if (cp >= 0xff01 && cp <= 0xff5e) {
      const ascii = String.fromCharCode(cp - 0xfee0);
      hit = { name: `Fullwidth "${ascii}"`, kind: 'homoglyph', replacement: ascii };
    } else if ((cp < 0x20 && ch !== '\n' && ch !== '\t' && ch !== '\r') || (cp >= 0x7f && cp < 0xa0)) {
      hit = { name: 'Control character', kind: 'control', replacement: '' };
    } else if (cp >= 0xe0000 && cp <= 0xe007f) {
      hit = { name: 'Tag character (can hide text)', kind: 'invisible', replacement: '' };
    } else if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) {
      // Variation selectors are normal after emoji; flag them elsewhere.
      if (!/\p{Extended_Pictographic}|\p{Emoji}/u.test(chars[i - 1] ?? ''))
        hit = { name: 'Variation selector', kind: 'invisible', replacement: '' };
    }
    if (hit) {
      if (findings.length < MAX_FINDINGS) findings.push({ index, line, column, char: ch, codePoint: hex(cp), ...hit });
      else truncated = true;
      cleaned += hit.replacement;
    } else {
      cleaned += ch;
    }
    index += ch.length;
    if (ch === '\n') {
      line++;
      column = 1;
    } else column++;
  });
  return { findings, cleaned, truncated };
}
