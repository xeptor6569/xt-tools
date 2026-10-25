import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

const ATTRS: Record<string, string> = {
  expires: 'Expires',
  'max-age': 'Max-Age',
  domain: 'Domain',
  path: 'Path',
  secure: 'Secure',
  httponly: 'HttpOnly',
  samesite: 'SameSite',
  partitioned: 'Partitioned',
  priority: 'Priority',
};

interface Pair {
  name: string;
  value: string;
  flag: boolean;
}

function splitParts(body: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let quote = '';
  for (const ch of body) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ';') {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function parsePair(part: string): Pair {
  const eq = part.indexOf('=');
  if (eq < 0) return { name: part, value: '', flag: true };
  let value = part.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { name: part.slice(0, eq).trim(), value, flag: false };
}

function canonical(name: string): string {
  return ATTRS[name.toLowerCase()] ?? name;
}

/** Parse a Cookie or Set-Cookie header into names, values and attributes. */
export function cookieParser(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  let body = trimmed;
  let kind: 'Cookie' | 'Set-Cookie' | '' = '';
  const prefix = /^(cookie|set-cookie)\s*:\s*/i.exec(body);
  if (prefix) {
    kind = prefix[1]!.toLowerCase() === 'set-cookie' ? 'Set-Cookie' : 'Cookie';
    body = body.slice(prefix[0].length);
  }
  const pairs = splitParts(body).map(parsePair);
  if (pairs.length === 0) throw new ToolInputError('Expected name=value pairs.');
  if (!kind) {
    const attribute = pairs.slice(1).some((pair) => ATTRS[pair.name.toLowerCase()]);
    kind = attribute ? 'Set-Cookie' : 'Cookie';
  }
  if (kind === 'Set-Cookie') {
    const [first, ...rest] = pairs;
    if (!first || first.flag) throw new ToolInputError('Set-Cookie starts with name=value.');
    const lines = ['kind: Set-Cookie', `name: ${first.name}`, `value: ${first.value}`];
    for (const attr of rest) {
      lines.push(attr.flag ? `${canonical(attr.name)}: true` : `${canonical(attr.name)}: ${attr.value}`);
    }
    return lines.join('\n');
  }
  const lines = ['kind: Cookie'];
  for (const pair of pairs) {
    if (pair.flag) throw new ToolInputError(`Cookie pair "${pair.name}" needs a value.`);
    lines.push(`${pair.name}: ${pair.value}`);
  }
  return lines.join('\n');
}
