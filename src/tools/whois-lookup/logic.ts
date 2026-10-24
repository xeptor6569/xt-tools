import { parseIpAddress } from '../../lib/ip-address.ts';
import { ToolInputError } from '../types.ts';

const DOMAIN_SERVERS = {
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
} as const;

export interface WhoisRow {
  label: string;
  value: string;
}

const COVERAGE =
  'This lookup covers .com, .net and .org, plus IP addresses answered directly by ARIN. Other registries are not contacted from this page.';

/** RDAP URL for a .com, .net or .org name, or an IP address ARIN can answer. */
export function whoisUrl(input: string): string {
  const value = input.trim();
  if (value.length === 0) throw new ToolInputError('Enter a domain name or IP address.');
  if (value.length > 253) throw new ToolInputError('That query is too long.');
  if (/[\s/\\?#]/.test(value) || value.includes('://')) {
    throw new ToolInputError('Enter a domain name or IP address, not a URL.');
  }
  if (value.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    return `https://rdap.arin.net/registry/ip/${parseIpAddress(value)}`;
  }

  let host: string;
  try {
    const url = new URL(`http://${value.replace(/\.$/, '')}`);
    if (url.pathname !== '/' || url.search || url.username || url.port) {
      throw new ToolInputError('Enter a domain name or IP address, not a URL.');
    }
    host = url.hostname;
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError(`"${value}" is not a domain name or IP address.`);
  }
  const suffix = host.split('.').at(-1) ?? '';
  const base = DOMAIN_SERVERS[suffix as keyof typeof DOMAIN_SERVERS];
  if (!base || !host.includes('.') || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) {
    throw new ToolInputError(COVERAGE);
  }
  return `${base}${host}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function vcardName(entity: Record<string, unknown>): string | undefined {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return undefined;
  for (const row of vcard[1]) {
    if (Array.isArray(row) && row[0] === 'fn' && typeof row[3] === 'string' && row[3].trim()) return row[3].trim();
  }
  return undefined;
}

/** Pulls the fields a person usually wants out of an RDAP object. */
export function parseRdap(json: unknown): WhoisRow[] {
  const record = asRecord(json);
  if (!record) throw new ToolInputError('The registry returned an unexpected response.');
  const rows: WhoisRow[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value) rows.push({ label, value });
  };

  const name =
    typeof record.ldhName === 'string' ? record.ldhName : typeof record.name === 'string' ? record.name : undefined;
  push('Name', name);
  push('Handle', typeof record.handle === 'string' ? record.handle : undefined);
  const status = strings(record.status);
  if (status.length > 0) push('Status', status.join(', '));

  const start = typeof record.startAddress === 'string' ? record.startAddress : undefined;
  const end = typeof record.endAddress === 'string' ? record.endAddress : undefined;
  if (start && end) push('Range', `${start} – ${end}`);

  const cidrs = Array.isArray(record.cidr0_cidrs)
    ? record.cidr0_cidrs.flatMap((item) => {
        const cidr = asRecord(item);
        if (!cidr || typeof cidr.length !== 'number') return [];
        const prefix =
          typeof cidr.v4prefix === 'string'
            ? cidr.v4prefix
            : typeof cidr.v6prefix === 'string'
              ? cidr.v6prefix
              : undefined;
        return prefix ? [`${prefix}/${cidr.length}`] : [];
      })
    : [];
  if (cidrs.length > 0) push('CIDR', cidrs.join(', '));

  const nameservers = Array.isArray(record.nameservers)
    ? record.nameservers.flatMap((item) => {
        const server = asRecord(item);
        return server && typeof server.ldhName === 'string' ? [server.ldhName] : [];
      })
    : [];
  if (nameservers.length > 0) push('Nameservers', nameservers.join(', '));

  const contacts = Array.isArray(record.entities)
    ? record.entities.flatMap((item) => {
        const entity = asRecord(item);
        if (!entity) return [];
        const roles = strings(entity.roles).join(', ');
        const label = vcardName(entity) || (typeof entity.handle === 'string' ? entity.handle : '');
        return label ? [`${label}${roles ? ` (${roles})` : ''}`] : [];
      })
    : [];
  if (contacts.length > 0) push('Contacts', contacts.join('; '));

  const events = Array.isArray(record.events)
    ? record.events.flatMap((item) => {
        const event = asRecord(item);
        if (!event || typeof event.eventAction !== 'string' || typeof event.eventDate !== 'string') return [];
        return [`${event.eventAction}: ${event.eventDate}`];
      })
    : [];
  if (events.length > 0) push('Events', events.join('; '));

  if (rows.length === 0) throw new ToolInputError('The registry returned a record with nothing to show.');
  return rows;
}
