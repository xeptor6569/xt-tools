import { ToolInputError } from '../types.ts';

export type ByteFormat = 'binary' | 'octal' | 'decimal' | 'hex';
export type Direction = 'encode' | 'decode';

const MAX_INPUT = 1_000_000;
const RADIX: Record<ByteFormat, number> = { binary: 2, octal: 8, decimal: 10, hex: 16 };
const WIDTH: Record<ByteFormat, number> = { binary: 8, octal: 3, decimal: 0, hex: 2 };

export interface BinaryResult {
  text: string;
  /** Decoded bytes weren't valid UTF-8, so they're shown as hex. */
  binary: boolean;
}

export function encodeBytes(text: string, format: ByteFormat, separator = ' '): string {
  return [...new TextEncoder().encode(text)]
    .map((b) => b.toString(RADIX[format]).padStart(WIDTH[format], '0'))
    .join(separator);
}

export function decodeBytes(text: string, format: ByteFormat): Uint8Array {
  const clean = text.trim().replace(/0x|0b/gi, ' ');
  if (clean === '') return new Uint8Array();
  let groups = clean.split(/[\s,;:-]+/).filter(Boolean);
  // Unseparated input: split into fixed-width groups.
  if (groups.length === 1 && WIDTH[format] > 0 && groups[0]!.length > WIDTH[format]) {
    const g = groups[0]!;
    if (g.length % WIDTH[format] !== 0) {
      throw new ToolInputError(`Without separators, ${format} input must come in groups of ${WIDTH[format]} digits.`);
    }
    groups = g.match(new RegExp(`.{${WIDTH[format]}}`, 'g')) ?? [];
  }
  const valid = { binary: /^[01]+$/, octal: /^[0-7]+$/, decimal: /^\d+$/, hex: /^[0-9a-f]+$/i }[format];
  return Uint8Array.from(
    groups.map((g) => {
      const n = valid.test(g) ? parseInt(g, RADIX[format]) : NaN;
      if (!(n >= 0 && n <= 255)) throw new ToolInputError(`"${g.slice(0, 20)}" isn't a valid ${format} byte (0–255).`);
      return n;
    }),
  );
}

export function textToBinary(
  input: string,
  format: ByteFormat = 'binary',
  direction: Direction = 'encode',
): BinaryResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (direction === 'encode') return { text: encodeBytes(input, format), binary: false };
  const bytes = decodeBytes(input, format);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), binary: false };
  } catch {
    return { text: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '), binary: true };
  }
}
