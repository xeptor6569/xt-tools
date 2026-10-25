import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

function encodePart(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    throw new ToolInputError('This text cannot be encoded as a query string.');
  }
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    throw new ToolInputError('Invalid percent-encoding in the query string.');
  }
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function queryToJson(input: string): string {
  const obj: Record<string, string | string[]> = {};
  const order: string[] = [];
  for (const part of input.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = decodePart(eq === -1 ? part : part.slice(0, eq));
    const val = decodePart(eq === -1 ? '' : part.slice(eq + 1));
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = val;
      order.push(key);
    } else {
      const prev = obj[key];
      obj[key] = Array.isArray(prev) ? [...prev, val] : [prev ?? '', val];
    }
  }
  const out: Record<string, string | string[]> = {};
  for (const key of order) {
    const val = obj[key];
    if (val !== undefined) out[key] = val;
  }
  return JSON.stringify(out);
}

function jsonToQuery(input: string): string {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new ToolInputError('This is not valid JSON.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToolInputError('Enter a JSON object such as {"a":"1"}.');
  }
  const parts: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const values = Array.isArray(item) ? item : [item];
    for (const one of values) parts.push(`${encodePart(key)}=${encodePart(scalar(one))}`);
  }
  return parts.join('&');
}

/** `a=1&b=2` becomes JSON, and a JSON object becomes a query string. */
export function queryStringJson(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return jsonToQuery(trimmed);
  return queryToJson(trimmed);
}
