import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

export type Encoding = 'quoted-printable' | 'utf-7' | 'utf-16be' | 'utf-16le' | 'percent';

export const ENCODINGS: ReadonlyArray<{ value: Encoding; label: string }> = [
  { value: 'quoted-printable', label: 'Quoted-printable (UTF-8)' },
  { value: 'utf-7', label: 'UTF-7' },
  { value: 'utf-16be', label: 'UTF-16 BE (hex)' },
  { value: 'utf-16le', label: 'UTF-16 LE (hex)' },
  { value: 'percent', label: 'Percent-encoding (UTF-8)' },
];

const MAX_INPUT = 1_000_000;
const utf8 = (s: string) => new TextEncoder().encode(s);
const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');

function strictUtf8(bytes: Uint8Array, what: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ToolInputError(`The ${what} data isn't valid UTF-8 text.`);
  }
}

// ---- Quoted-printable (RFC 2045 section 6.7) -------------------------------

export function qpEncode(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const bytes = utf8(line);
      const tokens = [...bytes].map((b, i) => {
        const trailingSpace = (b === 0x20 || b === 0x09) && i === bytes.length - 1;
        return (b >= 33 && b <= 126 && b !== 61) || ((b === 0x20 || b === 0x09) && !trailingSpace)
          ? String.fromCharCode(b)
          : `=${hex2(b)}`;
      });
      // Soft line breaks keep each encoded line at 76 characters or fewer.
      const out: string[] = [];
      let current = '';
      for (const t of tokens) {
        if (current.length + t.length > 75) {
          out.push(`${current}=`);
          current = '';
        }
        current += t;
      }
      out.push(current);
      return out.join('\n');
    })
    .join('\n');
}

export function qpDecode(text: string): string {
  const joined = text.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    const ch = joined[i]!;
    if (ch === '=') {
      const pair = joined.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(pair)) throw new ToolInputError(`Invalid quoted-printable escape "=${pair}".`);
      bytes.push(parseInt(pair, 16));
      i += 2;
    } else {
      bytes.push(...utf8(ch));
    }
  }
  return strictUtf8(Uint8Array.from(bytes), 'quoted-printable');
}

// ---- UTF-7 (RFC 2152) --------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIRECT = /[A-Za-z0-9'(),\-./:? \t\r\n!"#$%&*;<=>@[\]^_`{|}]/;

export function utf7Encode(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '+') {
      out += '+-';
      i++;
    } else if (DIRECT.test(ch)) {
      out += ch;
      i++;
    } else {
      let j = i;
      while (j < text.length && !DIRECT.test(text[j]!) && text[j] !== '+') j++;
      const units = [...text.slice(i, j)].flatMap((c) => [...Array(c.length).keys()].map((k) => c.charCodeAt(k)));
      let bits = 0;
      let buffer = 0;
      let b64 = '';
      for (const u of units) {
        buffer = (buffer << 16) | u;
        bits += 16;
        while (bits >= 6) {
          bits -= 6;
          b64 += B64[(buffer >> bits) & 63];
        }
        buffer &= (1 << bits) - 1;
      }
      if (bits > 0) b64 += B64[(buffer << (6 - bits)) & 63];
      const next = text[j];
      out += `+${b64}${next === undefined || next === '-' || B64.includes(next) ? '-' : ''}`;
      i = j;
    }
  }
  return out;
}

export function utf7Decode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch !== '+') {
      out += ch;
      continue;
    }
    if (text[i + 1] === '-') {
      out += '+';
      i++;
      continue;
    }
    let j = i + 1;
    let bits = 0;
    let buffer = 0;
    const units: number[] = [];
    while (j < text.length && B64.includes(text[j]!)) {
      buffer = (buffer << 6) | B64.indexOf(text[j]!);
      bits += 6;
      if (bits >= 16) {
        bits -= 16;
        units.push((buffer >> bits) & 0xffff);
        buffer &= (1 << bits) - 1;
      }
      j++;
    }
    if (j === i + 1) throw new ToolInputError('Invalid UTF-7: "+" must be followed by Base64 or "-".');
    out += String.fromCharCode(...units);
    i = text[j] === '-' ? j : j - 1;
  }
  return out;
}

// ---- UTF-16 hex and percent-encoding ----------------------------------------

function utf16Hex(text: string, littleEndian: boolean): string {
  return [...Array(text.length).keys()]
    .map((i) => {
      const u = text.charCodeAt(i);
      const [hi, lo] = [u >> 8, u & 0xff];
      return littleEndian ? `${hex2(lo)} ${hex2(hi)}` : `${hex2(hi)} ${hex2(lo)}`;
    })
    .join(' ');
}

function utf16FromHex(text: string, littleEndian: boolean): string {
  const clean = text.replace(/0x|[\s,]/gi, '');
  if (!/^([0-9a-f]{4})*$/i.test(clean)) throw new ToolInputError('UTF-16 hex must be a whole number of 2-byte units.');
  const units = (clean.match(/.{4}/g) ?? []).map((u) => {
    const [a, b] = [parseInt(u.slice(0, 2), 16), parseInt(u.slice(2), 16)];
    return littleEndian ? (b << 8) | a : (a << 8) | b;
  });
  return String.fromCharCode(...units);
}

function percentEncode(text: string): string {
  return [...utf8(text)]
    .map((b) => (/[A-Za-z0-9\-_.~]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : `%${hex2(b)}`))
    .join('');
}

function percentDecode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    throw new ToolInputError('Invalid percent-encoding (a % must be followed by two hex digits forming UTF-8).');
  }
}

export function encodeAll(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input === '') return [];
  return [
    { label: 'Quoted-printable', value: qpEncode(input) },
    { label: 'UTF-7', value: utf7Encode(input) },
    { label: 'UTF-16 BE (hex)', value: utf16Hex(input, false) },
    { label: 'UTF-16 LE (hex)', value: utf16Hex(input, true) },
    { label: 'Percent-encoding', value: percentEncode(input) },
  ];
}

export function decodeFrom(input: string, encoding: Encoding): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  switch (encoding) {
    case 'quoted-printable':
      return qpDecode(input);
    case 'utf-7':
      return utf7Decode(input);
    case 'utf-16be':
      return utf16FromHex(input, false);
    case 'utf-16le':
      return utf16FromHex(input, true);
    case 'percent':
      return percentDecode(input);
  }
}
