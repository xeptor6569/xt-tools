import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface HttpCall {
  method: string;
  url: string;
  headers: { name: string; value: string }[];
  body: string;
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

/** `METHOD URL`, header lines, a blank line, then the body. */
export function parseSnippet(input: string): HttpCall {
  const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const first = (lines[0] ?? '').trim();
  const match = /^([A-Za-z]+)\s+(\S+)$/.exec(first);
  if (!match) throw new ToolInputError('The first line must be a method and an absolute URL.');
  const method = (match[1] ?? '').toUpperCase();
  const url = match[2] ?? '';
  const headers: { name: string; value: string }[] = [];
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      break;
    }
    const header = /^([^:]+):\s*(.*)$/.exec(line.trim());
    if (!header) throw new ToolInputError(`Header line must look like "Name: value" (${line.slice(0, 60)}).`);
    headers.push({ name: (header[1] ?? '').trim(), value: header[2] ?? '' });
  }
  return { method, url, headers, body: lines.slice(i).join('\n') };
}

export function formatSnippet(call: Pick<HttpCall, 'method' | 'url'> & { headers: string; body: string }): string {
  const lines = [`${call.method || 'GET'} ${call.url}`.trimEnd()];
  if (call.headers.trim()) lines.push(call.headers.trim());
  if (call.body) lines.push('', call.body);
  return lines.join('\n');
}

/** Build fetch, Python requests and Go net/http from a small text request. Nothing is sent. */
export function httpSnippet(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  return renderSnippets(parseSnippet(input));
}
