import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

const BARE = new Set(['upgrade-insecure-requests', 'block-all-mixed-content']);

/** Join directive lines into one policy and warn about unsafe-inline, unsafe-eval and wildcards. */
export function cspBuilder(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const directives: string[] = [];
  const warnings: string[] = [];
  for (const raw of trimmed.split(/\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue;
    const match = /^([a-zA-Z][a-zA-Z0-9-]*)(?:\s+(\S.*))?$/.exec(line);
    if (!match) throw new ToolInputError(`Not a CSP directive: ${line.slice(0, 80)}`);
    const name = match[1]!.toLowerCase();
    const sources = (match[2] ?? '').trim().split(/\s+/).filter(Boolean);
    if (sources.length === 0 && !BARE.has(name)) throw new ToolInputError(`${name} needs at least one source.`);
    directives.push(sources.length > 0 ? `${name} ${sources.join(' ')}` : name);
    for (const source of sources) {
      const lower = source.toLowerCase();
      if (lower === "'unsafe-inline'" || lower === "'unsafe-eval'") warnings.push(`${name} allows ${lower}`);
      else if (source.includes('*')) warnings.push(`${name} allows a wildcard (${source})`);
    }
  }
  if (directives.length === 0) return '';
  const policy = directives.join('; ');
  if (warnings.length === 0) return policy;
  return `${policy}\n\nWarnings:\n${warnings.map((w) => `- ${w}`).join('\n')}`;
}
