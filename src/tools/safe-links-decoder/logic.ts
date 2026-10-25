import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const HOST = /^(?:[a-z0-9-]+\.)*safelinks\.protection\.outlook\.com$/i;

function unwrapOne(candidate: string): string {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return candidate;
  }
  const host = url.hostname;
  const safe = host === 'safelinks.protection.outlook.com' || HOST.test(host);
  if (url.protocol !== 'https:' || !safe) return candidate;
  const inner = url.searchParams.get('url');
  if (inner == null || inner === '') throw new ToolInputError('This Safe Links URL has no url parameter.');
  return inner;
}

/**
 * Replace Outlook Safe Links URLs with the `url` parameter. Other text is unchanged.
 * Nothing is fetched.
 */
export function safeLinksDecoder(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  let out = '';
  let i = 0;
  while (i < input.length) {
    const start = input.indexOf('https://', i);
    if (start < 0) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, start);
    let j = start;
    while (j < input.length && !/[\s<>"'`]/.test(input[j] ?? '')) j++;
    let end = j;
    while (end > start && /[.,);]/.test(input[end - 1] ?? '')) end--;
    out += unwrapOne(input.slice(start, end));
    out += input.slice(end, j);
    i = j;
  }
  return out;
}
