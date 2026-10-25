import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface HttpCall {
  method: string;
  url: string;
  headers: { name: string; value: string }[];
  body: string;
}

const SHORT_VALUE = new Set(['-X', '-H', '-d', '-u']);
const LONG_VALUE = [
  '--request',
  '--header',
  '--data-raw',
  '--data-binary',
  '--data-ascii',
  '--data',
  '--user',
  '--url',
];
const IGNORE = new Set([
  '-s',
  '-S',
  '-k',
  '-L',
  '-i',
  '-v',
  '-f',
  '-g',
  '--silent',
  '--show-error',
  '--insecure',
  '--location',
  '--include',
  '--verbose',
  '--fail',
  '--globoff',
  '--compressed',
]);
const IGNORE_LETTERS = new Set([...'sSkLivfg']);

function tokenize(input: string): string[] {
  const source = input.replace(/\\\r?\n/g, '');
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? '')) i++;
    if (i >= source.length) break;
    const quote = source[i];
    if (quote === "'" || quote === '"') {
      let j = i + 1;
      let buf = '';
      while (j < source.length && source[j] !== quote) {
        if (quote === '"' && source[j] === '\\') {
          const next = source[j + 1];
          if (next === 'n') buf += '\n';
          else if (next === 't') buf += '\t';
          else if (next === 'r') buf += '\r';
          else if (next !== undefined) buf += next;
          j += 2;
          continue;
        }
        buf += source[j] ?? '';
        j++;
      }
      if (j >= source.length) throw new ToolInputError('Unclosed quote in the cURL command.');
      tokens.push(buf);
      i = j + 1;
      continue;
    }
    let buf = '';
    while (i < source.length && !/\s/.test(source[i] ?? '')) {
      if (source[i] === '\\' && source[i + 1] !== undefined) {
        buf += source[i + 1];
        i += 2;
        continue;
      }
      buf += source[i] ?? '';
      i++;
    }
    tokens.push(buf);
  }
  return tokens;
}

function js(value: string): string {
  return JSON.stringify(value);
}

function assertCall(call: HttpCall): void {
  if (!/^[A-Z]+$/.test(call.method)) throw new ToolInputError('The method must be letters, such as GET or POST.');
  let url: URL;
  try {
    url = new URL(call.url);
  } catch {
    throw new ToolInputError('Enter an absolute http or https URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ToolInputError('Only http and https URLs are supported.');
  }
  for (const header of call.headers) {
    if (!/^[-!#$%&'*+.^_`|~0-9A-Za-z]+$/.test(header.name)) {
      throw new ToolInputError(`Invalid header name "${header.name.slice(0, 40)}".`);
    }
  }
}

function renderFetch(call: HttpCall): string {
  const lines: string[] = [];
  if (call.method !== 'GET' || call.body) lines.push(`  method: ${js(call.method)},`);
  if (call.headers.length > 0) {
    const headers = call.headers.map((header) => `    ${js(header.name)}: ${js(header.value)},`).join('\n');
    lines.push(`  headers: {\n${headers}\n  },`);
  }
  if (call.body) lines.push(`  body: ${js(call.body)},`);
  if (lines.length === 0) return `fetch(${js(call.url)});`;
  return `fetch(${js(call.url)}, {\n${lines.join('\n')}\n});`;
}

function renderPython(call: HttpCall): string {
  const lines = [
    'import requests',
    '',
    'response = requests.request(',
    `    ${js(call.method)},`,
    `    ${js(call.url)},`,
  ];
  if (call.headers.length > 0) {
    lines.push('    headers={');
    for (const header of call.headers) lines.push(`        ${js(header.name)}: ${js(header.value)},`);
    lines.push('    },');
  }
  if (call.body) lines.push(`    data=${js(call.body)},`);
  lines.push(')');
  return lines.join('\n');
}

function renderGo(call: HttpCall): string {
  const imports = call.body ? '\t"net/http"\n\t"strings"' : '\t"net/http"';
  const body = call.body ? `strings.NewReader(${js(call.body)})` : 'nil';
  const sets = call.headers.map((header) => `\treq.Header.Set(${js(header.name)}, ${js(header.value)})`);
  return [
    'package main',
    '',
    'import (',
    imports,
    ')',
    '',
    'func main() {',
    `\treq, err := http.NewRequest(${js(call.method)}, ${js(call.url)}, ${body})`,
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    ...sets,
    '\tresp, err := http.DefaultClient.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer resp.Body.Close()',
    '}',
    '',
  ].join('\n');
}

export function renderSnippets(call: HttpCall): string {
  assertCall(call);
  return `# fetch\n${renderFetch(call)}\n\n# Python\n${renderPython(call)}\n\n# Go\n${renderGo(call)}`;
}

function splitHeader(value: string): { name: string; value: string } {
  const colon = value.indexOf(':');
  if (colon <= 0) throw new ToolInputError('A header must look like "Name: value".');
  return { name: value.slice(0, colon).trim(), value: value.slice(colon + 1).trim() };
}

function basicValue(userpass: string): string {
  const bytes = new TextEncoder().encode(userpass);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

function longFlag(token: string): { name: string; inline: boolean } | undefined {
  for (const name of LONG_VALUE) {
    if (token === name) return { name, inline: false };
    if (token.startsWith(`${name}=`)) return { name, inline: true };
  }
  return undefined;
}

/** Parse a practical subset of cURL. The command is never executed. */
export function parseCurl(input: string): HttpCall {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new ToolInputError('Enter a cURL command.');
  let i = tokens[0] === 'curl' || tokens[0] === 'curl.exe' ? 1 : 0;
  let method = '';
  let url = '';
  const headers: { name: string; value: string }[] = [];
  const data: string[] = [];
  let sawData = false;
  let user = '';

  const apply = (flag: string, value: string) => {
    if (flag === '-X' || flag === '--request') method = value.toUpperCase();
    else if (flag === '-H' || flag === '--header') headers.push(splitHeader(value));
    else if (flag === '-u' || flag === '--user') user = value;
    else if (flag === '--url') {
      if (url) throw new ToolInputError('The command has more than one URL.');
      url = value;
    } else {
      sawData = true;
      data.push(value);
    }
  };

  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    const long = longFlag(token);
    if (long) {
      const value = long.inline ? token.slice(long.name.length + 1) : tokens[i + 1];
      if (value === undefined) throw new ToolInputError(`${token} needs a value.`);
      apply(long.name, value);
      i += long.inline ? 1 : 2;
      continue;
    }
    if (SHORT_VALUE.has(token)) {
      const value = tokens[i + 1];
      if (value === undefined) throw new ToolInputError(`${token} needs a value.`);
      apply(token, value);
      i += 2;
      continue;
    }
    const attached = [...SHORT_VALUE].find((flag) => token.startsWith(flag) && token.length > flag.length);
    if (attached) {
      apply(attached, token.slice(attached.length));
      i++;
      continue;
    }
    if (IGNORE.has(token)) {
      i++;
      continue;
    }
    if (/^-[A-Za-z]+$/.test(token) && [...token.slice(1)].every((ch) => IGNORE_LETTERS.has(ch))) {
      i++;
      continue;
    }
    if (token.startsWith('-')) throw new ToolInputError(`Unsupported option ${token.slice(0, 40)}.`);
    if (url) throw new ToolInputError('The command has more than one URL.');
    url = token;
    i++;
  }

  if (!url) throw new ToolInputError('The command has no URL.');
  if (!method) method = sawData ? 'POST' : 'GET';
  if (user) headers.push({ name: 'Authorization', value: basicValue(user.includes(':') ? user : `${user}:`) });
  return { method, url, headers, body: data.join('&') };
}

/** Turn a cURL command into fetch, Python requests and Go net/http. Nothing is executed. */
export function curlConverter(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  return renderSnippets(parseCurl(input));
}
