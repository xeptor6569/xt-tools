import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 20_000;

interface Style {
  label: string;
  upper?: number;
  lower?: number;
  digit?: number;
  holes?: Record<string, number>;
}

// Mathematical Alphanumeric Symbols (U+1D400–1D7FF). Some letters were
// encoded earlier in Letterlike Symbols, so those "holes" map elsewhere.
const STYLES: Style[] = [
  { label: 'Bold', upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  { label: 'Italic', upper: 0x1d434, lower: 0x1d44e, holes: { h: 0x210e } },
  { label: 'Bold italic', upper: 0x1d468, lower: 0x1d482 },
  {
    label: 'Script',
    upper: 0x1d49c,
    lower: 0x1d4b6,
    holes: {
      B: 0x212c,
      E: 0x2130,
      F: 0x2131,
      H: 0x210b,
      I: 0x2110,
      L: 0x2112,
      M: 0x2133,
      R: 0x211b,
      e: 0x212f,
      g: 0x210a,
      o: 0x2134,
    },
  },
  { label: 'Bold script', upper: 0x1d4d0, lower: 0x1d4ea },
  {
    label: 'Fraktur',
    upper: 0x1d504,
    lower: 0x1d51e,
    holes: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  },
  { label: 'Bold fraktur', upper: 0x1d56c, lower: 0x1d586 },
  {
    label: 'Double-struck',
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8,
    holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  { label: 'Sans-serif', upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
  { label: 'Sans-serif bold', upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  { label: 'Sans-serif italic', upper: 0x1d608, lower: 0x1d622 },
  { label: 'Monospace', upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  { label: 'Fullwidth', upper: 0xff21, lower: 0xff41, digit: 0xff10 },
];

const SMALL_CAPS = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
const UPSIDE: Record<string, string> = {
  a: 'ɐ',
  b: 'q',
  c: 'ɔ',
  d: 'p',
  e: 'ǝ',
  f: 'ɟ',
  g: 'ƃ',
  h: 'ɥ',
  i: 'ᴉ',
  j: 'ɾ',
  k: 'ʞ',
  l: 'l',
  m: 'ɯ',
  n: 'u',
  o: 'o',
  p: 'd',
  q: 'b',
  r: 'ɹ',
  s: 's',
  t: 'ʇ',
  u: 'n',
  v: 'ʌ',
  w: 'ʍ',
  x: 'x',
  y: 'ʎ',
  z: 'z',
  A: '∀',
  C: 'Ɔ',
  E: 'Ǝ',
  F: 'Ⅎ',
  G: '⅁',
  J: 'ſ',
  L: '˥',
  M: 'W',
  P: 'Ԁ',
  T: '┴',
  U: '∩',
  V: 'Λ',
  W: 'M',
  Y: '⅄',
  '1': 'Ɩ',
  '2': 'ᄅ',
  '3': 'Ɛ',
  '4': 'ㄣ',
  '5': 'ϛ',
  '6': '9',
  '7': 'ㄥ',
  '8': '8',
  '9': '6',
  '0': '0',
  '.': '˙',
  ',': "'",
  "'": ',',
  '"': '„',
  '?': '¿',
  '!': '¡',
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  _: '‾',
  '&': '⅋',
};

function mapStyle(text: string, s: Style): string {
  return [...text]
    .map((ch) => {
      if (s.holes?.[ch]) return String.fromCodePoint(s.holes[ch]);
      const c = ch.charCodeAt(0);
      if (ch.length === 1 && c >= 65 && c <= 90 && s.upper) return String.fromCodePoint(s.upper + c - 65);
      if (ch.length === 1 && c >= 97 && c <= 122 && s.lower) return String.fromCodePoint(s.lower + c - 97);
      if (ch.length === 1 && c >= 48 && c <= 57 && s.digit) return String.fromCodePoint(s.digit + c - 48);
      return ch;
    })
    .join('');
}

function circled(text: string): string {
  return [...text]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97);
      if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49);
      if (ch === '0') return '⓪';
      return ch;
    })
    .join('');
}

const combine = (text: string, mark: string) => [...text].map((ch) => (/\s/.test(ch) ? ch : ch + mark)).join('');

export function fancyText(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too long (maximum 20,000 characters).');
  if (input === '') return [];
  return [
    ...STYLES.map((s) => ({ label: s.label, value: mapStyle(input, s) })),
    {
      label: 'Small caps',
      value: [...input].map((ch) => (/[a-z]/.test(ch) ? SMALL_CAPS[ch.charCodeAt(0) - 97]! : ch)).join(''),
    },
    { label: 'Circled', value: circled(input) },
    {
      label: 'Upside down',
      value: [...input]
        .reverse()
        .map((ch) => UPSIDE[ch] ?? UPSIDE[ch.toLowerCase()] ?? ch)
        .join(''),
    },
    { label: 'Strikethrough', value: combine(input, '\u0336') },
    { label: 'Underlined', value: combine(input, '\u0332') },
  ];
}
