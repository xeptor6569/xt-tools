import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;
/** Inclusive upper bound for factor and prime. 2^64 is rejected. */
const MAX_ABS = 1n << 64n;
const TRIAL_LIMIT = 10_000n;
const STEP_CAP = 200_000;
const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** Deterministic Miller-Rabin for integers below 2^64 (bases from Sinclair). */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  for (const base of MR_BASES) {
    if (base % n === 0n) continue;
    let x = modPow(base, d, n);
    if (x === 1n || x === n - 1n) continue;
    let witnessed = false;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        witnessed = true;
        break;
      }
    }
    if (!witnessed) return false;
  }
  return true;
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function pollard(n: bigint, tick: () => void): bigint {
  if (n % 2n === 0n) return 2n;
  const root = isqrt(n);
  if (root * root === n) return root;
  for (const c of [1n, 2n, 3n, 5n, 7n, 11n, 13n]) {
    let x = 2n;
    let y = 2n;
    let d = 1n;
    let guard = 0;
    while (d === 1n && guard < 50_000) {
      tick();
      guard++;
      x = (x * x + c) % n;
      y = (y * y + c) % n;
      y = (y * y + c) % n;
      let diff = x - y;
      if (diff < 0n) diff = -diff;
      d = gcd(diff, n);
    }
    if (d > 1n && d < n) return d;
  }
  throw new ToolInputError('Could not factor this number within the step limit.');
}

function factorAbs(n: bigint): bigint[] {
  if (n < 2n) throw new ToolInputError('Enter an integer greater than 1 to factor.');
  if (n >= MAX_ABS) throw new ToolInputError('That integer is too large (maximum 64 bits).');
  let steps = 0;
  const tick = () => {
    if (++steps > STEP_CAP) throw new ToolInputError('Factorization exceeded the step limit. Try a smaller number.');
  };
  const out: bigint[] = [];
  let x = n;
  while (x % 2n === 0n) {
    out.push(2n);
    x /= 2n;
  }
  let p = 3n;
  while (p <= TRIAL_LIMIT && p * p <= x) {
    tick();
    while (x % p === 0n) {
      out.push(p);
      x /= p;
    }
    p += 2n;
  }
  const rest = (value: bigint): bigint[] => {
    if (value === 1n) return [];
    if (isPrime(value)) return [value];
    const d = pollard(value, tick);
    if (d <= 1n || d === value) throw new ToolInputError('Could not factor this number within the step limit.');
    return [...rest(d), ...rest(value / d)];
  };
  out.push(...rest(x));
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

function formatFactors(factors: bigint[]): string {
  const counts: Array<[bigint, number]> = [];
  for (const factor of factors) {
    const last = counts[counts.length - 1];
    if (last && last[0] === factor) last[1] += 1;
    else counts.push([factor, 1]);
  }
  return counts.map(([factor, count]) => (count === 1 ? factor.toString() : `${factor}^${count}`)).join(' × ');
}

function parseInteger(token: string, cap: bigint | undefined): bigint {
  const text = token.replace(/_/g, '');
  if (!/^[+-]?\d+$/.test(text)) throw new ToolInputError(`"${token}" is not a whole number.`);
  if (text.replace(/^[+-]/, '').length > 80) throw new ToolInputError('That integer is too long.');
  const value = BigInt(text);
  if (cap !== undefined) {
    const abs = value < 0n ? -value : value;
    if (abs >= cap) throw new ToolInputError('That integer is too large (maximum 64 bits).');
  }
  return value;
}

function integers(parts: string[], cap: bigint | undefined): bigint[] {
  if (parts.length === 0) throw new ToolInputError('Enter at least one whole number.');
  return parts.map((part) => parseInteger(part, cap));
}

/**
 * factor, gcd, lcm and prime. Factorization uses trial division, then Pollard Rho,
 * and stops with ToolInputError past 64 bits or the step cap.
 */
export function numberTheory(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';
  const parts = text.split(/[\s,]+/).filter((part) => part !== '');
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  switch (command) {
    case 'factor':
    case 'factors': {
      if (args.length !== 1) throw new ToolInputError('Use "factor 84".');
      const value = parseInteger(args[0]!, MAX_ABS);
      const abs = value < 0n ? -value : value;
      const body = formatFactors(factorAbs(abs));
      return value < 0n ? `-1 × ${body}` : body;
    }
    case 'gcd':
    case 'hcf': {
      if (args.length < 2) throw new ToolInputError('Use "gcd 12 18".');
      const values = integers(args, undefined);
      return values.reduce((a, b) => gcd(a, b)).toString();
    }
    case 'lcm': {
      if (args.length < 2) throw new ToolInputError('Use "lcm 4 6".');
      const values = integers(args, undefined).map((value) => (value < 0n ? -value : value));
      const result = values.reduce((a, b) => (a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b));
      return result.toString();
    }
    case 'prime':
    case 'isprime': {
      if (args.length !== 1) throw new ToolInputError('Use "prime 97".');
      const value = parseInteger(args[0]!, MAX_ABS);
      if (value < 2n) return `${value} is not prime`;
      return isPrime(value) ? `${value} is prime` : `${value} is not prime`;
    }
    default:
      throw new ToolInputError('Use factor, gcd, lcm or prime. For example: factor 84.');
  }
}
