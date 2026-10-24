import { ToolInputError } from '../types.ts';

export const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA', 'SRV', 'PTR'] as const;
export type DnsType = (typeof DNS_TYPES)[number];

const STATUS = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'] as const;
const TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA',
};

export interface DnsAnswer {
  name: string;
  type: string;
  ttl: string;
  data: string;
}

export interface DnsResult {
  status: string;
  answers: DnsAnswer[];
}

const MAX_NAME = 253;

/** Hostname, punycoded, with one trailing dot removed. */
export function parseDnsName(input: string): string {
  const raw = input.trim().replace(/\.$/, '');
  if (raw.length === 0) throw new ToolInputError('Enter a domain name.');
  if (raw.length > MAX_NAME) throw new ToolInputError('That name is longer than 253 characters.');
  if (/[\s/\\?#:@]/.test(raw) || raw.includes('://')) {
    throw new ToolInputError('Enter a domain name, not a URL.');
  }
  let host: string;
  try {
    const url = new URL(`http://${raw}`);
    if (url.pathname !== '/' || url.search || url.username || url.port) {
      throw new ToolInputError('Enter a domain name, not a URL.');
    }
    host = url.hostname;
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError(`"${raw}" is not a valid domain name.`);
  }
  if (
    !/^[a-z0-9.-]+$/.test(host) ||
    host.startsWith('.') ||
    host.endsWith('.') ||
    host.includes('..') ||
    !host.includes('.')
  ) {
    throw new ToolInputError(`"${raw}" is not a valid domain name.`);
  }
  return host;
}

export function dnsUrl(name: string, type: DnsType): string {
  const host = parseDnsName(name);
  return `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Parses a Cloudflare DNS-over-HTTPS JSON response (RFC 8484 application/dns-json). */
export function parseDoh(json: unknown): DnsResult {
  const record = asRecord(json);
  const status = record?.Status;
  if (!record || typeof status !== 'number' || !Number.isInteger(status) || status < 0) {
    throw new ToolInputError('The DNS service returned an unexpected response.');
  }
  const answers = Array.isArray(record.Answer) ? record.Answer : [];
  const rows: DnsAnswer[] = [];
  for (const item of answers) {
    const answer = asRecord(item);
    if (!answer || typeof answer.data !== 'string') continue;
    const type = typeof answer.type === 'number' ? (TYPE_NAMES[answer.type] ?? String(answer.type)) : '';
    const ttl = typeof answer.TTL === 'number' ? String(answer.TTL) : '';
    const name = typeof answer.name === 'string' ? answer.name : '';
    rows.push({ name, type, ttl, data: answer.data });
  }
  return { status: STATUS[status] ?? `RCODE ${status}`, answers: rows };
}
