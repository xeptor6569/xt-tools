import { parseIpAddress } from '../../lib/ip-address.ts';
import { ToolInputError } from '../types.ts';

export type IpQuery = { kind: 'self' } | { kind: 'address'; address: string };

export interface IpFact {
  label: string;
  value: string;
}

/** Empty input means "this connection". Anything else must be an IP address. */
export function parseIpQuery(input: string): IpQuery {
  if (input.length > 200) throw new ToolInputError('That address is too long.');
  const value = input.trim();
  if (value === '') return { kind: 'self' };
  return { kind: 'address', address: parseIpAddress(value) };
}

export function ipifyUrl(version: 4 | 6): string {
  return version === 4 ? 'https://api.ipify.org?format=json' : 'https://api64.ipify.org?format=json';
}

export function ipwhoUrl(address?: string): string {
  return address ? `https://ipwho.is/${address}` : 'https://ipwho.is/';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function parseIpify(json: unknown): string {
  const ip = asRecord(json)?.ip;
  if (typeof ip !== 'string') throw new ToolInputError('The address service returned an unexpected response.');
  return parseIpAddress(ip);
}

/** Reads the location fields from an ipwho.is response. Ignores its links and flag. */
export function parseIpwho(json: unknown): IpFact[] {
  const record = asRecord(json);
  if (!record) throw new ToolInputError('The location service returned an unexpected response.');
  if (record.success === false) {
    const message = typeof record.message === 'string' ? record.message.slice(0, 200) : '';
    throw new ToolInputError(message || 'No location was found for that address.');
  }

  const rows: IpFact[] = [];
  const push = (label: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) rows.push({ label, value: value.trim() });
  };
  push('IP address', record.ip);
  push('Type', record.type);
  const place = [record.city, record.region, record.country].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  if (place.length > 0) rows.push({ label: 'Location', value: place.join(', ') });
  if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
    rows.push({ label: 'Coordinates', value: `${record.latitude}, ${record.longitude}` });
  }
  const zone = asRecord(record.timezone);
  if (zone && typeof zone.id === 'string') {
    const utc = typeof zone.utc === 'string' ? ` (UTC${zone.utc})` : '';
    rows.push({ label: 'Time zone', value: `${zone.id}${utc}` });
  }
  const connection = asRecord(record.connection);
  if (connection) {
    const network = typeof connection.isp === 'string' ? connection.isp : connection.org;
    push('Network', network);
    if (typeof connection.asn === 'number') rows.push({ label: 'ASN', value: `AS${connection.asn}` });
  }
  if (rows.length === 0) throw new ToolInputError('The location service returned an unexpected response.');
  return rows;
}
