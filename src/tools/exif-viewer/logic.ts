import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_FIELDS = 200;
const MAX_OUTPUT = 20_000;

export const NO_EXIF = 'No EXIF data found.';

/**
 * Formats a JSON object of tags, one `Key: value` line per field.
 * Binary values are skipped. An empty object reports that nothing was found.
 */
export function exifViewer(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const text = input.trim();
  if (text === '') return '';
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new ToolInputError('Paste a JSON object of EXIF tags, or drop an image.');
  }
  if (data === null) return NO_EXIF;
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ToolInputError('EXIF JSON must be an object of tag names.');
  }
  return formatExif(data);
}

export function formatExif(data: unknown): string {
  const rows: Array<[string, string]> = [];
  flatten(data, '', rows);
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const clipped = rows.slice(0, MAX_FIELDS);
  if (clipped.length === 0) return NO_EXIF;
  let text = clipped.map(([key, value]) => `${key}: ${value}`).join('\n');
  if (rows.length > clipped.length) text += `\n… ${rows.length - clipped.length} more fields`;
  if (text.length > MAX_OUTPUT) text = `${text.slice(0, MAX_OUTPUT)}\n…`;
  return text;
}

function flatten(value: unknown, prefix: string, out: Array<[string, string]>): void {
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (prefix) out.push([prefix, formatScalar(prefix, value)]);
    return;
  }
  if (value instanceof Date) {
    if (prefix) out.push([prefix, value.toISOString()]);
    return;
  }
  if (ArrayBuffer.isView(value)) return;
  if (Array.isArray(value)) {
    if (!prefix) return;
    if (value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))) {
      out.push([prefix, value.map((item) => (item == null ? '' : String(item))).join(', ')]);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'makerNote' || key === 'thumbnail' || key === 'icc') continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

function formatScalar(key: string, value: string | number | boolean): string {
  if (typeof value === 'number' && /latitude|longitude/i.test(key) && Number.isFinite(value)) {
    return value.toFixed(6);
  }
  return String(value);
}
