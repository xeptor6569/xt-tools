import { formatIpv4, parseIpv4 } from '../../lib/ipv4.ts';
import { formatIpv6, parseIpv6 } from '../../lib/ipv6.ts';
import { ToolInputError, isToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

interface Entry {
  ip: string;
  host: string;
}

/** Merge hosts-file lines and adblock rules. Comments, blanks and duplicates are dropped. */
export function hostsMerger(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const raw of input.split(/\r?\n/)) {
    for (const entry of parseLine(raw)) {
      const key = `${entry.ip} ${entry.host}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }
  entries.sort((a, b) => (a.host < b.host ? -1 : a.host > b.host ? 1 : a.ip < b.ip ? -1 : a.ip > b.ip ? 1 : 0));
  return entries.map((entry) => `${entry.ip} ${entry.host}`).join('\n');
}

function parseLine(raw: string): Entry[] {
  let line = raw.trim();
  if (line === '' || line.startsWith('#') || line.startsWith('!') || line.startsWith('[') || line.startsWith('@@')) {
    return [];
  }
  const hash = line.indexOf('#');
  if (hash >= 0) line = line.slice(0, hash).trim();
  if (line === '') return [];
  const adblock = line.match(/^\|\|([^/*^|$]+)\^/);
  if (adblock) {
    const host = normalizeHost(adblock[1] ?? '');
    return host ? [{ ip: '0.0.0.0', host }] : [];
  }
  const parts = line.split(/\s+/);
  const ip = canonicalIp(parts[0] ?? '');
  if (ip && parts.length > 1) {
    return parts
      .slice(1)
      .map((part) => normalizeHost(part))
      .filter((host): host is string => host !== undefined)
      .map((host) => ({ ip, host }));
  }
  const host = parts.length === 1 ? normalizeHost(parts[0] ?? '') : undefined;
  return host ? [{ ip: '0.0.0.0', host }] : [];
}

function canonicalIp(token: string): string | undefined {
  try {
    if (token.includes(':')) return formatIpv6(parseIpv6(token));
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(token)) return formatIpv4(parseIpv4(token));
  } catch (error) {
    if (!isToolInputError(error)) throw error;
    return undefined;
  }
  return undefined;
}

function normalizeHost(token: string): string | undefined {
  const host = token.trim().replace(/\.$/, '').toLowerCase();
  if (host === '' || host.length > 253 || canonicalIp(host)) return undefined;
  const labels = host.split('.');
  if (labels.some((label) => !/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/i.test(label) || label.length > 63)) return undefined;
  return host;
}
