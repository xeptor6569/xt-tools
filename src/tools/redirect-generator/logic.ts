import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

function isTarget(value: string): boolean {
  return value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://');
}

function safe(value: string): boolean {
  return !/[\s{};"'\\]/.test(value);
}

/** `301 /old /new` becomes an nginx return and an Apache Redirect. Status defaults to 301. */
export function redirectGenerator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const nginx: string[] = [];
  const apache: string[] = [];
  for (const raw of trimmed.split(/\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:([1-5]\d\d)\s+)?(\S+)\s+(\S+)$/.exec(line);
    if (!match) throw new ToolInputError(`Use "301 /old /new" (got "${line.slice(0, 80)}").`);
    const status = match[1] ?? '301';
    const code = Number(status);
    if (code < 300 || code > 399) throw new ToolInputError(`Redirect status must be 3xx, not ${status}.`);
    const from = match[2] ?? '';
    const to = match[3] ?? '';
    if (!isTarget(from) || !isTarget(to) || !safe(from) || !safe(to)) {
      throw new ToolInputError('Paths must start with / or be absolute http(s) URLs, without spaces or quotes.');
    }
    nginx.push(`location = ${from} {\n    return ${status} ${to};\n}`);
    apache.push(`Redirect ${status} ${from} ${to}`);
  }
  if (nginx.length === 0) return '';
  return `# nginx\n${nginx.join('\n')}\n# Apache\n${apache.join('\n')}`;
}
