import { formatIpv4, parseIpv4 } from '../../lib/ipv4.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface Variant {
  label: string;
  value: string;
}

/** Dotted decimal, decimal integer, hex, or 32-bit binary, detected from the text. */
export function ipv4Converter(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return [];
  const n = detectIpv4(input.trim());
  return [
    { label: 'Dotted decimal', value: formatIpv4(n) },
    { label: 'Decimal', value: String(n) },
    { label: 'Hexadecimal', value: `0x${n.toString(16).padStart(8, '0').toUpperCase()}` },
    {
      label: 'Binary',
      value: [24, 16, 8, 0].map((shift) => ((n >>> shift) & 255).toString(2).padStart(8, '0')).join('.'),
    },
  ];
}

function detectIpv4(text: string): number {
  if (/^([01]{8}\.){3}[01]{8}$/.test(text)) {
    return text.split('.').reduce((acc, part) => acc * 256 + Number.parseInt(part, 2), 0);
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(text)) return parseIpv4(text);
  const compact = text.replace(/[\s_]/g, '');
  if (/^0x[0-9a-f]{1,8}$/i.test(compact)) return Number.parseInt(compact.slice(2), 16);
  if (/^[01]{32}$/.test(compact)) return Number.parseInt(compact, 2);
  if (/^[0-9a-f]{8}$/i.test(compact) && /[a-f]/i.test(compact)) return Number.parseInt(compact, 16);
  if (/^\d+$/.test(compact)) {
    const n = Number(compact);
    if (Number.isSafeInteger(n) && n <= 0xffffffff) return n;
    throw new ToolInputError(`${compact} is larger than an IPv4 address (4294967295).`);
  }
  throw new ToolInputError(
    `"${text}" is not an IPv4 address. Use dotted decimal, a decimal integer, 0x hex, or 32-bit binary.`,
  );
}
