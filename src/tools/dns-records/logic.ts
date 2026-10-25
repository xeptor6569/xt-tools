import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export type DnsKind = 'SPF' | 'DMARC' | 'CAA' | 'SRV' | 'DKIM';

export interface DnsForm {
  kind: DnsKind;
  domain: string;
  spf: string;
  dmarcPolicy: string;
  dmarcRua: string;
  dmarcAdkim: string;
  dmarcAspf: string;
  caaFlags: string;
  caaTag: string;
  caaValue: string;
  srvService: string;
  srvProto: string;
  srvPriority: string;
  srvWeight: string;
  srvPort: string;
  srvTarget: string;
  dkimSelector: string;
  dkimKey: string;
}

/** Build one recipe from the form. Empty when a required field is still blank. */
export function recipeFromForm(form: DnsForm): string {
  const domain = form.domain.trim();
  if (domain === '') return '';
  if (form.kind === 'SPF') {
    const terms = form.spf.trim();
    return terms === '' ? '' : `SPF ${domain} ${terms}`;
  }
  if (form.kind === 'DMARC') {
    const tags = [`p=${form.dmarcPolicy.trim() || 'none'}`];
    const rua = mailto(form.dmarcRua);
    if (rua) tags.push(`rua=${rua}`);
    if (form.dmarcAdkim.trim()) tags.push(`adkim=${form.dmarcAdkim.trim()}`);
    if (form.dmarcAspf.trim()) tags.push(`aspf=${form.dmarcAspf.trim()}`);
    return `DMARC ${domain} ${tags.join(' ')}`;
  }
  if (form.kind === 'CAA') {
    const value = form.caaValue.trim();
    if (value === '') return '';
    return `CAA ${domain} ${form.caaFlags.trim() || '0'} ${form.caaTag.trim() || 'issue'} ${value}`;
  }
  if (form.kind === 'SRV') {
    const service = stripLabel(form.srvService.trim() || 'sip');
    const proto = stripLabel(form.srvProto.trim() || 'tcp');
    const target = form.srvTarget.trim() || `${service}.${domain}`;
    return `SRV _${service}._${proto}.${domain} ${form.srvPriority.trim() || '0'} ${form.srvWeight.trim() || '0'} ${form.srvPort.trim() || '0'} ${target}`;
  }
  const selector = form.dkimSelector.trim();
  const key = form.dkimKey.replace(/\s+/g, '');
  if (selector === '' || key === '') return '';
  return `DKIM ${domain} ${selector} ${key.replace(/^p=/i, '')}`;
}

/** One recipe per line. Each record is a name and a value. */
export function dnsRecords(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 100 KB).');
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (lines.length === 0) return '';
  return lines
    .map((line) => {
      const record = parseRecipe(line);
      return `Name: ${record.name}\nValue: ${record.value}`;
    })
    .join('\n\n');
}

function parseRecipe(line: string): { name: string; value: string } {
  const tokens = line.split(/\s+/);
  const kind = (tokens[0] ?? '').toUpperCase();
  if (kind === 'SPF') return spf(tokens);
  if (kind === 'DMARC') return dmarc(tokens);
  if (kind === 'CAA') return caa(tokens);
  if (kind === 'SRV') return srv(tokens);
  if (kind === 'DKIM') return dkim(tokens);
  throw new ToolInputError(
    `"${line}" is not a DNS recipe. Start with SPF, DMARC, CAA, SRV, or DKIM, for example "SPF example.com mx -all".`,
  );
}

function spf(tokens: string[]): { name: string; value: string } {
  const domain = domainName(tokens[1] ?? '', 'SPF needs a domain.');
  const terms = tokens.slice(2).join(' ').trim();
  if (terms === '') throw new ToolInputError('SPF needs at least one mechanism, such as mx or -all.');
  const value = /^v=spf1\b/i.test(terms) ? terms.replace(/^v=spf1\b/i, 'v=spf1') : `v=spf1 ${terms}`;
  return { name: domain, value };
}

function dmarc(tokens: string[]): { name: string; value: string } {
  const domain = domainName(tokens[1] ?? '', 'DMARC needs a domain.');
  const tags = tokens.slice(2);
  if (tags.length === 0) throw new ToolInputError('DMARC needs a p= policy (none, quarantine, or reject).');
  const pairs = tags.map((tag) => {
    if (!/^[a-z0-9_]+=\S+$/i.test(tag)) throw new ToolInputError(`"${tag}" is not a DMARC tag. Use name=value.`);
    return tag;
  });
  if (!pairs.some((tag) => /^p=/i.test(tag))) {
    throw new ToolInputError('DMARC needs a p= policy (none, quarantine, or reject).');
  }
  const body = pairs.filter((tag) => !/^v=/i.test(tag));
  return { name: `_dmarc.${domain}`, value: ['v=DMARC1', ...body].join('; ') };
}

function caa(tokens: string[]): { name: string; value: string } {
  const domain = domainName(tokens[1] ?? '', 'CAA needs a domain.');
  const flags = tokens[2] ?? '';
  const tag = tokens[3] ?? '';
  const raw = tokens.slice(4).join(' ').trim();
  if (!/^\d{1,3}$/.test(flags) || Number(flags) > 255)
    throw new ToolInputError('CAA flags must be an integer from 0 to 255.');
  if (!/^[a-z0-9]{1,15}$/i.test(tag)) throw new ToolInputError('CAA needs a tag such as issue, issuewild, or iodef.');
  if (raw === '') throw new ToolInputError('CAA needs a value, such as letsencrypt.org.');
  return { name: domain, value: `${Number(flags)} ${tag.toLowerCase()} "${quote(raw)}"` };
}

function srv(tokens: string[]): { name: string; value: string } {
  const second = tokens[1] ?? '';
  const structured = second.startsWith('_') || /^\d+$/.test(tokens[2] ?? '');
  const name = structured
    ? domainName(second, 'SRV needs a name such as _sip._tcp.example.com.')
    : srvName(tokens[1] ?? '', tokens[2] ?? '', tokens[3] ?? '');
  const numbers = structured ? tokens.slice(2, 5) : tokens.slice(4, 7);
  const targetText = (structured ? tokens.slice(5) : tokens.slice(7)).join('').trim();
  if (numbers.length !== 3 || targetText === '') {
    throw new ToolInputError('SRV needs a priority, weight, port, and target.');
  }
  const [priority, weight, port] = numbers.map((part, index) =>
    u16(part, ['priority', 'weight', 'port'][index] ?? 'number'),
  );
  return { name, value: `${priority} ${weight} ${port} ${target(targetText)}` };
}

function dkim(tokens: string[]): { name: string; value: string } {
  const domain = domainName(tokens[1] ?? '', 'DKIM needs a domain.');
  const selector = dnsLabel(tokens[2] ?? '', 'DKIM needs a selector, such as s1.');
  const key = tokens.slice(3).join('').replace(/\s+/g, '').replace(/^p=/i, '');
  if (key === '') throw new ToolInputError('Paste the DKIM public key. This tool does not generate one.');
  if (!/^[A-Za-z0-9+/=]+$/.test(key) || key.length < 16) {
    throw new ToolInputError('The DKIM public key should be the base64 p= value from the key pair.');
  }
  return { name: `${selector}._domainkey.${domain}`, value: `v=DKIM1; k=rsa; p=${key}` };
}

function srvName(domain: string, service: string, proto: string): string {
  const host = domainName(domain, 'SRV needs a domain.');
  const svc = stripLabel(service);
  const protocol = stripLabel(proto);
  if (!isLabel(svc) || !isLabel(protocol))
    throw new ToolInputError('SRV needs a service and a protocol, such as sip and tcp.');
  return `_${svc}._${protocol}.${host}`;
}

function domainName(text: string, message: string): string {
  const value = text.trim().replace(/\.$/, '').toLowerCase();
  if (value.length === 0 || value.length > 253 || value.split('.').some((part) => !isLabel(part))) {
    throw new ToolInputError(message === '' ? `"${text}" is not a domain name.` : message);
  }
  return value;
}

function dnsLabel(text: string, message: string): string {
  const value = text.trim().toLowerCase();
  if (!isLabel(value)) throw new ToolInputError(message);
  return value;
}

function isLabel(text: string): boolean {
  return text.length > 0 && text.length <= 63 && /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/i.test(text);
}

function stripLabel(text: string): string {
  return text.replace(/^_+/, '').toLowerCase();
}

function u16(text: string, name: string): number {
  if (!/^\d{1,5}$/.test(text) || Number(text) > 65535) {
    throw new ToolInputError(`SRV ${name} must be an integer from 0 to 65535.`);
  }
  return Number(text);
}

function target(text: string): string {
  const host = domainName(text, 'SRV needs a target host name.');
  return `${host}.`;
}

function quote(text: string): string {
  const bare = text.replace(/^"(.*)"$/, '$1');
  return bare.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function mailto(text: string): string {
  const value = text.trim();
  if (value === '') return '';
  if (/^mailto:/i.test(value)) return value;
  return `mailto:${value}`;
}
