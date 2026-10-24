import { ToolInputError } from '../tools/types.ts';

const MAX = 64;

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every(
    (part) => /^\d{1,3}$/.test(part) && Number(part) <= 255 && !(part.length > 1 && part.startsWith('0')),
  );
}

/** Returns a canonical IPv4 or IPv6 address, or throws ToolInputError. */
export function parseIpAddress(text: string): string {
  const value = text.trim();
  if (value.length === 0 || value.length > MAX) {
    throw new ToolInputError('Enter an IPv4 or IPv6 address.');
  }
  if (isIpv4(value)) return value;
  if (!value.includes(':') || value.includes('%') || !/^[0-9a-f:]+$/i.test(value)) {
    throw new ToolInputError(`"${value}" is not an IPv4 or IPv6 address.`);
  }
  try {
    const hostname = new URL(`http://[${value}]`).hostname;
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) {
      throw new ToolInputError(`"${value}" is not an IPv4 or IPv6 address.`);
    }
    return hostname.slice(1, -1);
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError(`"${value}" is not an IPv4 or IPv6 address.`);
  }
}
