import { ToolInputError } from '../types.ts';
import { providerFor } from './data.ts';

const MAX_INPUT = 1_000_000;

export interface EmailOptions {
  /** Lowercase the local part (the domain is always lowercased). */
  lowercaseLocal: boolean;
  /** Apply the provider rules from data.ts (Gmail dots, plus and minus tags). */
  providerRules: boolean;
  /** Strip +tags for every domain, not just known providers. */
  stripAllTags: boolean;
  /** Keep only the first occurrence of each normalized address. */
  dedupe: boolean;
}

export const DEFAULT_OPTIONS: EmailOptions = {
  lowercaseLocal: true,
  providerRules: true,
  stripAllTags: false,
  dedupe: true,
};

export type EmailStatus = 'ok' | 'duplicate' | 'invalid';

export interface EmailRow {
  /** 1-based line number in the input. */
  line: number;
  original: string;
  /** Empty for invalid entries. */
  normalized: string;
  status: EmailStatus;
  notes: string[];
}

export interface EmailResult {
  /** Normalized addresses in first-seen order (deduplicated when the option is on). */
  addresses: string[];
  rows: EmailRow[];
  invalid: number;
  duplicates: number;
  changed: number;
}

const encoder = new TextEncoder();
const utf8Length = (s: string) => encoder.encode(s).length;

/** Splits on new lines, commas and semicolons, but not inside double quotes ("Doe, John" <j@example.com>). */
export function splitEntries(input: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  let line = 1;
  let start = 0;
  let startLine = 1;
  let quoted = false;
  const push = (end: number) => {
    const text = input.slice(start, end).trim();
    if (text !== '') out.push({ line: startLine, text });
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') quoted = !quoted;
    else if (c === '\n') {
      // A new line always ends an entry, even after an unbalanced quote.
      push(i);
      quoted = false;
      line++;
      start = i + 1;
      startLine = line;
    } else if (!quoted && (c === ',' || c === ';')) {
      push(i);
      start = i + 1;
      startLine = line;
    }
  }
  push(input.length);
  return out;
}

class Invalid extends Error {}

const LOCAL_FORBIDDEN = /[\s"(),:;<>@[\\\]\p{Cc}]/u;
const DOMAIN_FORBIDDEN = /[\s"'`(),:;<>@[\\\]/?#%^{|}\p{Cc}]/u;
const LONE_SURROGATE = /\p{Cs}/u;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Converts a domain to lowercase ASCII (punycode for IDNs) with the URL parser's UTS #46 mapping. */
export function domainToAscii(domain: string): string {
  if (domain === '') throw new Invalid('nothing after @');
  if (DOMAIN_FORBIDDEN.test(domain)) throw new Invalid('the domain contains a character that is not allowed');
  if (LONE_SURROGATE.test(domain)) throw new Invalid('the domain contains broken Unicode');
  let host: string;
  try {
    host = new URL(`http://${domain}`).hostname;
  } catch {
    throw new Invalid('the domain is not a valid host name');
  }
  if (host.length > 253) throw new Invalid('the domain is longer than 253 characters');
  const labels = host.split('.');
  if (labels.length < 2) throw new Invalid('the domain needs a dot, like example.com');
  for (const label of labels) {
    if (!LABEL.test(label)) throw new Invalid(`the domain part “${label.slice(0, 40)}” is not valid`);
  }
  if (!TLD.test(labels.at(-1)!)) throw new Invalid(`“${labels.at(-1)!.slice(0, 40)}” is not a valid top-level domain`);
  return host;
}

function normalizeOne(text: string, options: EmailOptions): { normalized: string; notes: string[] } {
  const notes: string[] = [];
  let addr = text;
  if (/^mailto:/i.test(addr)) {
    addr = addr.slice(7).split('?')[0]!.trim();
    notes.push('mailto: removed');
  }
  const angle = /^(.*?)<([^<>]*)>$/s.exec(addr);
  if (angle) {
    addr = angle[2]!.trim();
    notes.push(angle[1]!.trim() ? 'display name removed' : 'angle brackets removed');
  }

  const at = addr.lastIndexOf('@');
  if (at === -1) throw new Invalid('no @');
  let local = addr.slice(0, at);
  let domain = addr.slice(at + 1);
  if (local === '') throw new Invalid('nothing before @');
  if (local.startsWith('"')) throw new Invalid('quoted local parts are not supported');
  const bad = LOCAL_FORBIDDEN.exec(local);
  if (bad)
    throw new Invalid(
      bad[0] === '@' ? 'more than one @' : `the part before @ contains “${bad[0].trim() || 'a space'}”`,
    );
  if (LONE_SURROGATE.test(local)) throw new Invalid('the part before @ contains broken Unicode');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    throw new Invalid('dots can’t start, end or repeat in the part before @');
  }
  if (utf8Length(local) > 64) throw new Invalid('the part before @ is longer than 64 bytes');

  if (domain.endsWith('.')) {
    domain = domain.slice(0, -1);
    notes.push('trailing dot removed');
  }
  const ascii = domainToAscii(domain);
  if (/[^\x20-\x7e]/.test(domain)) notes.push('domain converted to ASCII (punycode)');
  else if (ascii !== domain) notes.push('domain lowercased');
  domain = ascii;

  if (options.lowercaseLocal && local !== local.toLowerCase()) {
    local = local.toLowerCase();
    notes.push('lowercased');
  }

  const stripTag = (sep: string, provider?: string) => {
    const i = local.indexOf(sep);
    if (i > 0) {
      notes.push(`“${local.slice(i)}” tag removed${provider ? ` (${provider})` : ''}`);
      local = local.slice(0, i);
    }
  };

  const rule = options.providerRules ? providerFor(domain) : undefined;
  if (rule) {
    stripTag(rule.tagSeparator, rule.name);
    if (rule.ignoreDots && local.includes('.')) {
      local = local.replaceAll('.', '');
      notes.push(`dots removed (${rule.name} ignores them)`);
    }
    if (rule.canonicalDomain && rule.canonicalDomain !== domain) {
      notes.push(`${domain} → ${rule.canonicalDomain}`);
      domain = rule.canonicalDomain;
    }
  }
  if (options.stripAllTags) stripTag('+');

  const normalized = `${local}@${domain}`;
  if (utf8Length(normalized) > 254) throw new Invalid('the address is longer than 254 bytes');
  return { normalized, notes };
}

/** Normalizes one address per line (or comma/semicolon separated). */
export function emailNormalizer(input: string, options: EmailOptions = DEFAULT_OPTIONS): EmailResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const rows: EmailRow[] = [];
  const addresses: string[] = [];
  const seen = new Map<string, number>();
  let invalid = 0;
  let duplicates = 0;
  let changed = 0;

  for (const { line, text } of splitEntries(input)) {
    try {
      const { normalized, notes } = normalizeOne(text, options);
      const first = seen.get(normalized);
      if (normalized !== text) changed++;
      if (first !== undefined) {
        duplicates++;
        rows.push({
          line,
          original: text,
          normalized,
          status: 'duplicate',
          notes: [...notes, `duplicate of line ${first}`],
        });
        if (!options.dedupe) addresses.push(normalized);
        continue;
      }
      seen.set(normalized, line);
      addresses.push(normalized);
      rows.push({ line, original: text, normalized, status: 'ok', notes });
    } catch (e) {
      if (!(e instanceof Invalid)) throw e;
      invalid++;
      rows.push({ line, original: text, normalized: '', status: 'invalid', notes: [`invalid: ${e.message}`] });
    }
  }
  return { addresses, rows, invalid, duplicates, changed };
}
