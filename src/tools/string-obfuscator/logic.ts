import { ToolInputError } from '../types.ts';

export interface ObfuscateOptions {
  keepStart?: number;
  keepEnd?: number;
  maskChar?: string;
  /** Keep characters such as spaces, @, . and - visible. */
  keepSeparators?: boolean;
  /** Replace each hidden run with a fixed number of mask characters, hiding the length. */
  fixedLength?: number;
}

const MAX_INPUT = 1_000_000;
const SEPARATORS = /[\s@.\-_:/]/u;

function maskLine(line: string, o: Required<ObfuscateOptions>): string {
  const chars = [...line];
  if (chars.length === 0) return '';
  const start = Math.min(o.keepStart, chars.length);
  const end = Math.min(o.keepEnd, Math.max(0, chars.length - start));
  const head = chars.slice(0, start).join('');
  const tail = end > 0 ? chars.slice(chars.length - end).join('') : '';
  const middle = chars.slice(start, chars.length - end);
  if (o.fixedLength > 0) return head + o.maskChar.repeat(o.fixedLength) + tail;
  return head + middle.map((c) => (o.keepSeparators && SEPARATORS.test(c) ? c : o.maskChar)).join('') + tail;
}

/** Masks each line, keeping the first and last few characters. */
export function stringObfuscator(input: string, options: ObfuscateOptions = {}): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const o: Required<ObfuscateOptions> = {
    keepStart: options.keepStart ?? 4,
    keepEnd: options.keepEnd ?? 4,
    maskChar: options.maskChar || '•',
    keepSeparators: options.keepSeparators ?? false,
    fixedLength: options.fixedLength ?? 0,
  };
  if ([...o.maskChar].length !== 1) throw new ToolInputError('The mask must be a single character.');
  for (const n of [o.keepStart, o.keepEnd, o.fixedLength]) {
    if (!Number.isInteger(n) || n < 0 || n > 1000)
      throw new ToolInputError('Counts must be whole numbers from 0 to 1000.');
  }
  return input
    .split('\n')
    .map((line) => maskLine(line, o))
    .join('\n');
}
