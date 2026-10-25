import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

const SIZE: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

/** "1.5 GiB at 100 Mbps" -> a duration in seconds and a short human form. */
export function transferTime(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const match = trimmed.match(/^\s*(\d*\.?\d+)\s*([a-z]+)\s+at\s+(\d*\.?\d+)\s*([a-z/]+)\s*$/i);
  if (!match) {
    throw new ToolInputError('Use a size and a rate, for example "1.5 GiB at 100 Mbps" or "1 GB at 1 MB/s".');
  }
  const bytes = parseSize(match[1] ?? '', match[2] ?? '');
  const perSecond = parseRate(match[3] ?? '', match[4] ?? '');
  if (bytes === 0) return '0 seconds';
  const ms = Math.round((bytes / perSecond) * 1000);
  if (!Number.isFinite(ms) || ms > Number.MAX_SAFE_INTEGER) {
    throw new ToolInputError('That transfer is too long to express.');
  }
  return formatDuration(ms);
}

function parseSize(raw: string, unit: string): number {
  const count = number(raw);
  const key = unit.toLowerCase().replace(/bytes?$/, 'b');
  const factor = SIZE[key];
  if (factor === undefined) {
    throw new ToolInputError(`Unknown size unit "${unit}". Use B, KB, MB, GB, TB, KiB, MiB, GiB, or TiB.`);
  }
  return count * factor;
}

function parseRate(raw: string, unit: string): number {
  const count = number(raw);
  if (count === 0) throw new ToolInputError('The rate must be greater than zero.');
  const match = unit.match(/^(k|m|g|t)?(i)?(bits?|bytes?|b)(\/s|ps)?$/i);
  if (!match) {
    throw new ToolInputError(`Unknown rate unit "${unit}". Use Mbps, Mb/s, MB/s, or similar.`);
  }
  const prefix = (match[1] ?? '').toLowerCase();
  const binary = Boolean(match[2]);
  const body = match[3] ?? '';
  const bytes = /^byte/i.test(body) || body.includes('B');
  const scale = binary ? 1024 : 1000;
  const power = prefix === '' ? 1 : scale ** ({ k: 1, m: 2, g: 3, t: 4 } as const)[prefix as 'k' | 'm' | 'g' | 't'];
  const perSecond = count * power;
  return bytes ? perSecond : perSecond / 8;
}

function number(raw: string): number {
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) throw new ToolInputError(`"${raw}" is not a number.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new ToolInputError(`"${raw}" is not a positive number.`);
  return value;
}

function formatDuration(ms: number): string {
  const seconds = formatSeconds(ms);
  const unit = seconds === '1' ? 'second' : 'seconds';
  if (ms < 60_000) return `${seconds} ${unit}`;
  return `${seconds} ${unit} (${human(ms)})`;
}

function formatSeconds(ms: number): string {
  const whole = Math.floor(ms / 1000);
  const frac = ms % 1000;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(3, '0')}`;
}

function human(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  let rest = ms % 86_400_000;
  const hours = Math.floor(rest / 3_600_000);
  rest %= 3_600_000;
  const mins = Math.floor(rest / 60_000);
  rest %= 60_000;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hr`);
  if (mins) parts.push(`${mins} min`);
  if (rest !== 0 || parts.length === 0) parts.push(`${formatSeconds(rest)} sec`);
  return parts.join(' ');
}
