import { ToolInputError } from '../types.ts';

/**
 * mulberry32, by Tommy Ettinger. One uint32 state, returns the next uint32 in [0, 2^32).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** FNV-1a over the seed bytes, so a Uint8Array seed is stable. */
export function seedFromBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeSeed(seed: number | Uint8Array): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) throw new ToolInputError('Seed must be a finite number.');
    return seed >>> 0;
  }
  return seedFromBytes(seed);
}

/** Whole-number seed, or undefined when the field is empty (the UI then uses crypto). */
export function parseSeed(text: string): number | undefined {
  if (text.length > 40) throw new ToolInputError('Seed is too long.');
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (!/^[+-]?\d+$/.test(trimmed)) throw new ToolInputError('Seed must be a whole number.');
  const value = BigInt(trimmed);
  return Number(value & 0xffffffffn);
}

export function parseCount(text: string): number {
  if (text.length > 12) throw new ToolInputError('Count is too long.');
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Count must be a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > 1000) throw new ToolInputError('Count must be from 1 to 1000.');
  return n;
}

export function parseBound(text: string, label: string): number {
  if (text.length > 16) throw new ToolInputError(`${label} is too long.`);
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) throw new ToolInputError(`${label} must be a whole number.`);
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) throw new ToolInputError(`${label} is too large.`);
  return n;
}

/** Unbiased integer in [0, span). */
export function nextInt(rng: () => number, span: number): number {
  if (!Number.isInteger(span) || span <= 0 || span > 0x1_0000_0000) {
    throw new ToolInputError('That range is too large.');
  }
  const limit = Math.floor(0x1_0000_0000 / span) * span;
  let value = rng();
  let guard = 0;
  while (value >= limit) {
    value = rng();
    if (++guard > 32) break;
  }
  return value % span;
}

export function randomIntegers(count: number, min: number, max: number, seed: number | Uint8Array): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new ToolInputError('Count must be from 1 to 1000.');
  }
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new ToolInputError('Min and max must be whole numbers.');
  if (min > max) throw new ToolInputError('Min cannot be greater than max.');
  const span = max - min + 1;
  if (span > 0x1_0000_0000) throw new ToolInputError('That range is too large.');
  const rng = mulberry32(normalizeSeed(seed));
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(min + nextInt(rng, span));
  return out;
}

export function parseDice(notation: string): { dice: number; faces: number } {
  const match = /^(\d+)\s*d\s*(\d+)$/i.exec(notation.trim());
  if (!match) throw new ToolInputError('Use dice notation like 2d6.');
  const dice = Number(match[1]);
  const faces = Number(match[2]);
  if (dice < 1 || dice > 100) throw new ToolInputError('Roll between 1 and 100 dice.');
  if (faces < 2 || faces > 1000) throw new ToolInputError('A die needs between 2 and 1000 faces.');
  return { dice, faces };
}

export function rollDice(notation: string, times: number, seed: number | Uint8Array): string[] {
  if (!Number.isInteger(times) || times < 1 || times > 1000) {
    throw new ToolInputError('Count must be from 1 to 1000.');
  }
  const { dice, faces } = parseDice(notation);
  const rng = mulberry32(normalizeSeed(seed));
  const lines: string[] = [];
  for (let t = 0; t < times; t++) {
    const facesRolled: number[] = [];
    let sum = 0;
    for (let i = 0; i < dice; i++) {
      const face = 1 + nextInt(rng, faces);
      facesRolled.push(face);
      sum += face;
    }
    lines.push(dice === 1 ? String(sum) : `${facesRolled.join(' + ')} = ${sum}`);
  }
  return lines;
}

/** Fisher-Yates shuffle of lines, using mulberry32. */
export function shuffleLines(text: string, seed: number | Uint8Array): string {
  if (text.length > 1_000_000) throw new ToolInputError('That list is too long (maximum 1 MB).');
  const lines = text.split(/\r?\n/);
  if (lines.length > 10_000) throw new ToolInputError('Enter at most 10000 lines.');
  const rng = mulberry32(normalizeSeed(seed));
  for (let i = lines.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = lines[i]!;
    lines[i] = lines[j]!;
    lines[j] = tmp;
  }
  return lines.join('\n');
}
