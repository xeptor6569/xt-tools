import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_N = 8;

/** Reduced rational. Denominator is always positive. */
class Frac {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new ToolInputError('Division by zero.');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  add(other: Frac): Frac {
    return new Frac(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  sub(other: Frac): Frac {
    return new Frac(this.n * other.d - other.n * this.d, this.d * other.d);
  }

  mul(other: Frac): Frac {
    return new Frac(this.n * other.n, this.d * other.d);
  }

  div(other: Frac): Frac {
    if (other.n === 0n) throw new ToolInputError('Division by zero.');
    return new Frac(this.n * other.d, this.d * other.n);
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function parseFrac(token: string): Frac {
  const slash = /^([+-]?\d+)\/(\d+)$/.exec(token);
  if (slash) {
    const denominator = slash[2]!;
    if (denominator.length > 12 || slash[1]!.replace(/^[+-]/, '').length > 12) {
      throw new ToolInputError('Numbers must have at most 12 digits.');
    }
    return new Frac(BigInt(slash[1]!), BigInt(denominator));
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(token);
  if (!match) throw new ToolInputError(`"${token}" is not a number.`);
  const digits = match[2]! + (match[3] ?? '');
  if (digits.length > 12) throw new ToolInputError('Numbers must have at most 12 digits.');
  const sign = match[1] === '-' ? -1n : 1n;
  const scale = 10n ** BigInt((match[3] ?? '').length);
  return new Frac(BigInt(digits) * sign, scale);
}

function formatFrac(value: Frac): string {
  if (value.d === 1n) return value.n.toString();
  const digits = (value.n < 0n ? -value.n : value.n).toString().length + value.d.toString().length;
  if (digits > 18) {
    const approx = Number(value.n) / Number(value.d);
    if (Number.isFinite(approx)) return formatNumber(approx);
  }
  return `${value.n}/${value.d}`;
}

type Matrix = Frac[][];

function parseMatrix(lines: string[]): Matrix {
  const rows: Matrix = [];
  for (const line of lines) {
    const cells = line
      .trim()
      .split(/[\s,]+/)
      .filter((cell) => cell !== '');
    if (cells.length === 0) continue;
    if (cells.length > MAX_N) throw new ToolInputError(`Matrices are limited to ${MAX_N} columns.`);
    rows.push(cells.map(parseFrac));
  }
  if (rows.length === 0) throw new ToolInputError('Enter at least one row of numbers.');
  if (rows.length > MAX_N) throw new ToolInputError(`Matrices are limited to ${MAX_N} rows.`);
  const width = rows[0]!.length;
  for (const row of rows) {
    if (row.length !== width) throw new ToolInputError('Each row of a matrix must have the same number of values.');
  }
  return rows;
}

function blocks(lines: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function formatMatrix(matrix: Matrix): string {
  return matrix.map((row) => row.map(formatFrac).join(' ')).join('\n');
}

function assertSquare(matrix: Matrix, op: string): void {
  if (matrix.length !== matrix[0]!.length) throw new ToolInputError(`${op} needs a square matrix.`);
}

function sameShape(a: Matrix, b: Matrix): boolean {
  return a.length === b.length && a[0]!.length === b[0]!.length;
}

function add(a: Matrix, b: Matrix): Matrix {
  if (!sameShape(a, b)) throw new ToolInputError('Add needs two matrices of the same shape.');
  return a.map((row, i) => row.map((cell, j) => cell.add(b[i]![j]!)));
}

function mul(a: Matrix, b: Matrix): Matrix {
  if (a[0]!.length !== b.length) {
    throw new ToolInputError('Multiply needs the first matrix to have as many columns as the second has rows.');
  }
  const rows = a.length;
  const cols = b[0]!.length;
  const mid = b.length;
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Frac[] = [];
    for (let j = 0; j < cols; j++) {
      let sum = new Frac(0n);
      for (let k = 0; k < mid; k++) sum = sum.add(a[i]![k]!.mul(b[k]![j]!));
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}

function transpose(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const cols = matrix[0]!.length;
  const out: Matrix = [];
  for (let c = 0; c < cols; c++) {
    const row: Frac[] = [];
    for (let r = 0; r < rows; r++) row.push(matrix[r]![c]!);
    out.push(row);
  }
  return out;
}

function determinant(matrix: Matrix): Frac {
  assertSquare(matrix, 'det');
  const n = matrix.length;
  const a = matrix.map((row) => row.map((cell) => cell));
  let det = new Frac(1n);
  let sign = 1n;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && a[pivot]![col]!.isZero()) pivot++;
    if (pivot === n) return new Frac(0n);
    if (pivot !== col) {
      const tmp = a[col]!;
      a[col] = a[pivot]!;
      a[pivot] = tmp;
      sign = -sign;
    }
    const piv = a[col]![col]!;
    det = det.mul(piv);
    for (let row = col + 1; row < n; row++) {
      const factor = a[row]![col]!.div(piv);
      for (let k = col; k < n; k++) a[row]![k] = a[row]![k]!.sub(factor.mul(a[col]![k]!));
    }
  }
  return det.mul(new Frac(sign));
}

function inverse(matrix: Matrix): Matrix {
  assertSquare(matrix, 'inv');
  const n = matrix.length;
  const a: Matrix = matrix.map((row, i) => [
    ...row.map((cell) => cell),
    ...Array.from({ length: n }, (_, j) => new Frac(i === j ? 1n : 0n)),
  ]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && a[pivot]![col]!.isZero()) pivot++;
    if (pivot === n) throw new ToolInputError('Matrix is singular and has no inverse.');
    if (pivot !== col) {
      const tmp = a[col]!;
      a[col] = a[pivot]!;
      a[pivot] = tmp;
    }
    const piv = a[col]![col]!;
    for (let k = 0; k < 2 * n; k++) a[col]![k] = a[col]![k]!.div(piv);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row]![col]!;
      if (factor.isZero()) continue;
      for (let k = 0; k < 2 * n; k++) a[row]![k] = a[row]![k]!.sub(factor.mul(a[col]![k]!));
    }
  }
  return a.map((row) => row.slice(n));
}

const OPS: Record<string, number> = {
  add: 2,
  mul: 2,
  multiply: 2,
  transpose: 1,
  det: 1,
  determinant: 1,
  inv: 1,
  inverse: 1,
};

/**
 * First line is the operation (add, mul, transpose, det, inv).
 * Rows follow. Separate the two matrices of add and mul with a blank line.
 * Matrices are at most 8 by 8. Results are exact fractions when they stay small.
 */
export function matrixCalculator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';
  const lines = text.split(/\r?\n/);
  const op = lines[0]!.trim().toLowerCase();
  const needed = OPS[op];
  if (needed === undefined) {
    throw new ToolInputError('Start with add, mul, transpose, det or inv, then the rows.');
  }
  const groups = blocks(lines.slice(1));
  if (groups.length !== needed) {
    throw new ToolInputError(
      needed === 2 ? `${op} needs two matrices, separated by a blank line.` : `${op} needs one matrix.`,
    );
  }
  const matrices = groups.map(parseMatrix);
  const first = matrices[0]!;
  switch (op) {
    case 'add':
      return formatMatrix(add(first, matrices[1]!));
    case 'mul':
    case 'multiply':
      return formatMatrix(mul(first, matrices[1]!));
    case 'transpose':
      return formatMatrix(transpose(first));
    case 'det':
    case 'determinant':
      return formatFrac(determinant(first));
    case 'inv':
    case 'inverse':
      return formatMatrix(inverse(first));
    default:
      throw new ToolInputError('Start with add, mul, transpose, det or inv, then the rows.');
  }
}
